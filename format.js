// Discord OAuth2 — handles authorize URL, code exchange, refresh, and
// returns valid access tokens (auto-refreshing as needed).

import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { saveTokens, getTokens, deleteTokens } from '../db/repository.js';

const API = 'https://discord.com/api/v10';

export function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: config.discord.clientId,
    redirect_uri: config.oauth.redirectUri,
    response_type: 'code',
    scope: 'identify guilds.join',
    state,
    prompt: 'consent',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: config.discord.clientId,
    client_secret: config.discord.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.oauth.redirectUri,
  });
  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`exchangeCode ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: config.discord.clientId,
    client_secret: config.discord.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`refreshAccessToken ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function fetchOAuthUser(accessToken) {
  const res = await fetch(`${API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`fetchOAuthUser ${res.status}`);
  return res.json();
}

/** Get a valid access token (refresh if expired), or null if unavailable. */
export async function getValidAccessToken(guildId, userId) {
  const row = await getTokens(guildId, userId);
  if (!row) return null;

  if (row.expires_at && Number(row.expires_at) - Date.now() > 60_000) {
    return row.access_token;
  }

  try {
    const fresh = await refreshAccessToken(row.refresh_token);
    await saveTokens(guildId, userId, {
      ...fresh,
      refresh_token: fresh.refresh_token || row.refresh_token,
    });
    return fresh.access_token;
  } catch (err) {
    logger.warn(`[oauth] refresh failed for ${userId}@${guildId}:`, err.message);
    await deleteTokens(guildId, userId);
    return null;
  }
}
