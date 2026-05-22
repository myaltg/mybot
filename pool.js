// Re-adds a user to a guild using PUT /guilds/{id}/members/{user.id}.

import { PermissionFlagsBits, AuditLogEvent } from 'discord.js';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { getValidAccessToken } from './oauthService.js';
import { deleteTokens, logRejoinAttempt } from '../db/repository.js';

const API = 'https://discord.com/api/v10';

/**
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function forceRejoin(guild, userId, { nickname, roleIds } = {}) {
  const accessToken = await getValidAccessToken(guild.id, userId);
  if (!accessToken) {
    await logRejoinAttempt(guild.id, userId, false, 'no_oauth_token');
    return { ok: false, reason: 'no_oauth_token' };
  }

  // Already in guild? race-condition guard
  const existing = await guild.members.fetch(userId).catch(() => null);
  if (existing) {
    await logRejoinAttempt(guild.id, userId, true, 'already_member');
    return { ok: true, reason: 'already_member' };
  }

  const payload = { access_token: accessToken };
  if (nickname) payload.nick = nickname.slice(0, 32);
  if (Array.isArray(roleIds) && roleIds.length) payload.roles = roleIds;

  const res = await fetch(`${API}/guilds/${guild.id}/members/${userId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${config.discord.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 201 || res.status === 204) {
    logger.info(`[forceRejoin] ✅ re-added ${userId} → ${guild.name}`);
    await logRejoinAttempt(guild.id, userId, true, `status_${res.status}`);
    return { ok: true };
  }

  const text = await res.text().catch(() => '');
  logger.warn(`[forceRejoin] ${res.status} for ${userId}@${guild.id}: ${text}`);

  // Token revoked → clean up so we stop retrying
  if (res.status === 401 || res.status === 403) {
    await deleteTokens(guild.id, userId);
  }

  await logRejoinAttempt(guild.id, userId, false, `api_${res.status}`);
  return { ok: false, reason: `api_${res.status}` };
}

/** Don't re-add users who were just banned/kicked by a moderator. */
export async function wasRecentlyBannedOrKicked(guild, userId, windowMs = 5000) {
  try {
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) return false;

    const cutoff = Date.now() - windowMs;
    const [bans, kicks] = await Promise.all([
      guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 5 }).catch(() => null),
      guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 }).catch(() => null),
    ]);
    const hit = (logs) =>
      logs?.entries.some((e) => e.target?.id === userId && e.createdTimestamp >= cutoff);
    return hit(bans) || hit(kicks);
  } catch {
    return false;
  }
}
