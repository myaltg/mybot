// The crown jewel: tries force-rejoin first, falls back to goodbye message.

import { Events, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { COLORS } from '../utils/config.js';
import { getGuildConfig, getTokens, countRecentRejoins } from '../db/repository.js';
import { forceRejoin, wasRecentlyBannedOrKicked } from '../services/forceRejoinService.js';
import { formatMessage } from '../utils/format.js';
import { logger } from '../utils/logger.js';

export default {
  name: Events.GuildMemberRemove,
  async execute(member) {
    const { guild, user } = member;
    try {
      const cfg = await getGuildConfig(guild.id);

      /* ---------- 1. Try force-rejoin ---------- */
      if (cfg.force_rejoin_enabled && !user.bot) {
        const decision = await shouldRejoin(member, cfg);
        if (decision.go) {
          await new Promise((r) => setTimeout(r, cfg.rejoin_cooldown_ms));
          const result = await forceRejoin(guild, user.id, {
            nickname: member.nickname || undefined,
          });
          if (result.ok) {
            logger.info(`[forceRejoin] ✅ ${user.tag} pulled back into ${guild.name}`);
            return; // Skip goodbye — they didn't really leave
          }
          logger.warn(`[forceRejoin] ${user.id} failed: ${result.reason}`);
        } else {
          logger.debug(`[forceRejoin] skip ${user.id}: ${decision.reason}`);
        }
      }

      /* ---------- 2. Goodbye message ---------- */
      if (cfg.goodbye_enabled && cfg.goodbye_channel_id) {
        const channel = guild.channels.cache.get(cfg.goodbye_channel_id);
        if (channel?.isTextBased?.()) {
          const me = guild.members.me;
          const perms = me ? channel.permissionsFor(me) : null;
          if (perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
            const text = formatMessage(cfg.goodbye_message, member);
            await channel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(COLORS.error)
                  .setTitle('👋 Goodbye')
                  .setDescription(text)
                  .setThumbnail(user.displayAvatarURL())
                  .setTimestamp(),
              ],
            });
          }
        }
      }
    } catch (err) {
      logger.error('guildMemberRemove error:', err);
    }
  },
};

async function shouldRejoin(member, cfg) {
  const { guild, user } = member;

  if (cfg.excluded_user_ids?.includes(user.id))
    return { go: false, reason: 'user_excluded' };

  if (cfg.excluded_role_ids?.length &&
      member.roles?.cache?.some((r) => cfg.excluded_role_ids.includes(r.id)))
    return { go: false, reason: 'role_excluded' };

  if (await wasRecentlyBannedOrKicked(guild, user.id))
    return { go: false, reason: 'banned_or_kicked' };

  const recent = await countRecentRejoins(guild.id, user.id, 24 * 60 * 60 * 1000);
  if (recent >= cfg.max_rejoins_per_day)
    return { go: false, reason: 'rate_limited' };

  const tokens = await getTokens(guild.id, user.id);
  if (!tokens) return { go: false, reason: 'no_oauth_token' };

  return { go: true };
}
