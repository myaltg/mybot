import { Events, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { COLORS } from '../utils/config.js';
import { getGuildConfig } from '../db/repository.js';
import { logger } from '../utils/logger.js';
import { formatMessage } from '../utils/format.js';

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    try {
      const cfg = await getGuildConfig(member.guild.id);

      // Auto-assign verify role if configured (e.g. role given to all members after auth)
      if (cfg.verify_role_id) {
        const role = member.guild.roles.cache.get(cfg.verify_role_id);
        if (role && member.guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
          await member.roles.add(role).catch((e) =>
            logger.warn(`Could not add verify role: ${e.message}`));
        }
      }

      if (!cfg.welcome_enabled || !cfg.welcome_channel_id) return;
      const channel = member.guild.channels.cache.get(cfg.welcome_channel_id);
      if (!channel?.isTextBased?.()) return;

      const text = formatMessage(cfg.welcome_message, member);
      await channel.send({
        content: `<@${member.id}>`,
        allowedMentions: { users: [member.id] },
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.success)
            .setTitle('👋 Welcome!')
            .setDescription(text)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp(),
        ],
      });
    } catch (err) {
      logger.error('guildMemberAdd error:', err);
    }
  },
};
