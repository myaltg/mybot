import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { config, COLORS } from '../utils/config.js';
import { getGuildConfig, upsertGuildConfig } from '../db/repository.js';

export default {
  data: new SlashCommandBuilder()
    .setName('forcerejoin')
    .setDescription('Manage automatic re-joining of members who leave')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('enable').setDescription('Turn on force-rejoin'))
    .addSubcommand((s) => s.setName('disable').setDescription('Turn off force-rejoin'))
    .addSubcommand((s) => s.setName('status').setDescription('Show current config'))
    .addSubcommand((s) => s.setName('link').setDescription('Get the verification link'))
    .addSubcommand((s) =>
      s.setName('exclude-user')
        .setDescription('Never re-add this user')
        .addUserOption((o) => o.setName('user').setDescription('User to exclude').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('exclude-role')
        .setDescription('Skip members who had this role')
        .addRoleOption((o) => o.setName('role').setDescription('Role to exclude').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const cfg = await getGuildConfig(guildId);

    if (sub === 'enable') {
      await upsertGuildConfig(guildId, { force_rejoin_enabled: true });
      return interaction.reply({
        embeds: [embed(COLORS.success, '✅ Force-Rejoin Enabled',
          `Members who authorized the bot will be auto-added back when they leave.\n\nShare the verification link with \`/forcerejoin link\`.`)],
        ephemeral: true,
      });
    }

    if (sub === 'disable') {
      await upsertGuildConfig(guildId, { force_rejoin_enabled: false });
      return interaction.reply({
        embeds: [embed(COLORS.error, '🛑 Force-Rejoin Disabled', 'Members will not be auto-re-added.')],
        ephemeral: true,
      });
    }

    if (sub === 'status') {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.info)
            .setTitle('Force-Rejoin Status')
            .addFields(
              { name: 'Enabled', value: cfg.force_rejoin_enabled ? '✅ Yes' : '❌ No', inline: true },
              { name: 'Max / 24h', value: String(cfg.max_rejoins_per_day), inline: true },
              { name: 'Cooldown', value: `${cfg.rejoin_cooldown_ms} ms`, inline: true },
              { name: 'Excluded users', value: String(cfg.excluded_user_ids?.length || 0), inline: true },
              { name: 'Excluded roles', value: String(cfg.excluded_role_ids?.length || 0), inline: true },
            ),
        ],
        ephemeral: true,
      });
    }

    if (sub === 'link') {
      const url = `${config.oauth.publicUrl}/oauth/start?guild=${guildId}`;
      return interaction.reply({
        embeds: [embed(COLORS.primary, '🔗 Verification Link',
          `Send this to members so they can authorize the bot:\n\n${url}\n\n` +
          `**Once they approve, they'll be auto-re-added if they ever leave.**`)],
        ephemeral: true,
      });
    }

    if (sub === 'exclude-user') {
      const user = interaction.options.getUser('user', true);
      const set = new Set(cfg.excluded_user_ids);
      set.add(user.id);
      await upsertGuildConfig(guildId, { excluded_user_ids: [...set] });
      return interaction.reply({
        embeds: [embed(COLORS.success, 'User Excluded', `${user.tag} will not be force-rejoined.`)],
        ephemeral: true,
      });
    }

    if (sub === 'exclude-role') {
      const role = interaction.options.getRole('role', true);
      const set = new Set(cfg.excluded_role_ids);
      set.add(role.id);
      await upsertGuildConfig(guildId, { excluded_role_ids: [...set] });
      return interaction.reply({
        embeds: [embed(COLORS.success, 'Role Excluded', `Members with **${role.name}** will not be force-rejoined.`)],
        ephemeral: true,
      });
    }
  },
};

function embed(color, title, description) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
}
