// Express router for Discord OAuth2 flow.
//   GET /oauth/start?guild=<guildId>   -> redirects to Discord consent
//   GET /oauth/callback                -> exchanges code, saves tokens

import express from 'express';
import crypto from 'node:crypto';
import { buildAuthorizeUrl, exchangeCode, fetchOAuthUser } from '../services/oauthService.js';
import { saveTokens } from '../db/repository.js';
import { logger } from '../utils/logger.js';

const STATE_TTL = 10 * 60 * 1000;
const states = new Map(); // state -> { guildId, createdAt }

function newState(guildId) {
  const s = crypto.randomBytes(24).toString('hex');
  states.set(s, { guildId, createdAt: Date.now() });
  // GC
  for (const [k, v] of states) if (Date.now() - v.createdAt > STATE_TTL) states.delete(k);
  return s;
}

function consumeState(s) {
  const e = states.get(s);
  if (!e) return null;
  states.delete(s);
  if (Date.now() - e.createdAt > STATE_TTL) return null;
  return e;
}

export function createOAuthRouter() {
  const router = express.Router();

  router.get('/start', (req, res) => {
    const guildId = String(req.query.guild || '');
    if (!/^\d{17,20}$/.test(guildId)) return res.status(400).send('Invalid guild id');
    res.redirect(buildAuthorizeUrl(newState(guildId)));
  });

  router.get('/callback', async (req, res) => {
    const { code, state, error } = req.query;
    if (error) return res.status(400).send(`Discord error: ${error}`);
    if (!code || !state) return res.status(400).send('Missing code/state');

    const entry = consumeState(String(state));
    if (!entry) return res.status(400).send('Invalid or expired state');

    try {
      const tokens = await exchangeCode(String(code));
      const me = await fetchOAuthUser(tokens.access_token);
      await saveTokens(entry.guildId, me.id, tokens);
      logger.info(`[oauth] linked ${me.username} (${me.id}) → ${entry.guildId}`);

      res.type('html').send(successPage(me.username));
    } catch (err) {
      logger.error('[oauth] callback failed:', err);
      res.status(500).send('OAuth failed. Please try again.');
    }
  });

  return router;
}

function successPage(username) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Verified</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#2b2d31;color:#fff;
       display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
  .card{background:#1e1f22;padding:40px 56px;border-radius:14px;text-align:center;
        box-shadow:0 8px 32px rgba(0,0,0,.4);max-width:420px}
  h1{margin:0 0 12px;font-size:26px}
  p{color:#b5bac1;margin:0}
  .check{font-size:48px;margin-bottom:12px}
</style></head>
<body><div class="card">
  <div class="check">✅</div>
  <h1>You're verified, ${escapeHtml(username)}!</h1>
  <p>You may now close this tab and return to Discord.</p>
</div></body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
