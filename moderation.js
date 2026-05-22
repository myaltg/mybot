import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { COLORS } from '../utils/config.js';
import { getGuildConfig, upsertGuildConfig } from '../db/repository.js';

export default {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure welcome / goodbye messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s.setName('set-welcome')
        .setDescription('Enable welcome messages in a channel')
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Welcome channel')
            .addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption((o) =>
          o.setName('message').setDescription('Use {user} {server} {memberCount}')))
    .addSubcommand((s) =>
      s.setName('set-goodbye')
        .setDescription('Enable goodbye messages in a channel')
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Goodbye channel')
            .addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption((o) =>
          o.setName('message').setDescription('Use {user} {memberCount}')))
    .addSubcommand((s) => s.setName('disable-welcome').setDescription('Turn off welcome messages'))
    .addSubcommand((s) => s.setName('disable-goodbye').setDescription('Turn off goodbye messages'))
    .addSubcommand((s) => s.setName('status').setDescription('Show current welcome/goodbye config')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const cfg = await getGuildConfig(guildId);

    if (sub === 'set-welcome') {
      const channel = interaction.options.getChannel('channel', true);
      const message = interaction.options.getString('message') || cfg.welcome_message;
      await upsertGuildConfig(guildId, {
        welcome_enabled: true,
        welcome_channel_id: channel.id,
        welcome_message: message,
      });
      return reply(interaction, COLORS.success, '✅ Welcome enabled',
        `Channel: ${channel}\nMessage: \`${message}\``);
    }

    if (sub === 'set-goodbye') {
      const channel = interaction.options.getChannel('channel', true);
      const message = interaction.options.getString('message') || cfg.goodbye_message;
      await upsertGuildConfig(guildId, {
        goodbye_enabled: true,
        goodbye_channel_id: channel.id,
        goodbye_message: message,
      });
      return reply(interaction, COLORS.success, '✅ Goodbye enabled',
        `Channel: ${channel}\nMessage: \`${message}\``);
    }

    if (sub === 'disable-welcome') {
      await upsertGuildConfig(guildId, { welcome_enabled: false });
      return reply(interaction, COLORS.error, '🛑 Welcome disabled', 'No welcome messages will be sent.');
    }

    if (sub === 'disable-goodbye') {
      await upsertGuildConfig(guildId, { goodbye_enabled: false });
      return reply(interaction, COLORS.error, '🛑 Goodbye disabled', 'No goodbye messages will be sent.');
    }

    if (sub === 'status') {
      return interaction.reply({
        embeds: [
          new EmbedBuilder().setColor(COLORS.info).setTitle('Welcome / Goodbye').addFields(
            { name: 'Welcome', value: cfg.welcome_enabled
              ? `✅ <#${cfg.welcome_channel_id}>\n\`${cfg.welcome_message}\``
              : '❌ Disabled' },
            { name: 'Goodbye', value: cfg.goodbye_enabled
              ? `✅ <#${cfg.goodbye_channel_id}>\n\`${cfg.goodbye_message}\``
              : '❌ Disabled' },
          ),
        ],
        ephemeral: true,
      });
    }
  },
};

function reply(interaction, color, title, desc) {
  return interaction.reply({
    embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc)],
    ephemeral: true,
  });
}
