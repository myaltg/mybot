// /verify panel  -> posts an embed with a "Verify" button that links to OAuth.

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from 'discord.js';
import { config, COLORS } from '../utils/config.js';
import { getGuildConfig, upsertGuildConfig } from '../db/repository.js';

export default {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Set up the verification panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s.setName('panel')
        .setDescription('Post a verification panel in a channel')
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Where to post the panel')
            .addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption((o) =>
          o.setName('title').setDescription('Panel title'))
        .addStringOption((o) =>
          o.setName('description').setDescription('Panel description')))
    .addSubcommand((s) =>
      s.setName('set-role')
        .setDescription('Role to give once verified (optional)')
        .addRoleOption((o) =>
          o.setName('role').setDescription('Verified role').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'panel') {
      const channel = interaction.options.getChannel('channel', true);
      const title = interaction.options.getString('title') || '🔒 Verification';
      const desc =
        interaction.options.getString('description') ||
        'Click **Verify** below to gain access to the server.\n' +
        'You will be redirected to Discord to authorize the bot.';

      const url = `${config.oauth.publicUrl}/oauth/start?guild=${guildId}`;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Verify')
          .setStyle(ButtonStyle.Link)
          .setURL(url)
      );

      await channel.send({
        embeds: [
          new EmbedBuilder().setColor(COLORS.primary).setTitle(title).setDescription(desc),
        ],
        components: [row],
      });

      return interaction.reply({
        content: `✅ Panel posted in ${channel}`,
        ephemeral: true,
      });
    }

    if (sub === 'set-role') {
      const role = interaction.options.getRole('role', true);
      await upsertGuildConfig(guildId, { verify_role_id: role.id });
      return interaction.reply({
        content: `✅ Verified role set to **${role.name}**`,
        ephemeral: true,
      });
    }
  },
};
