// /ban /kick /timeout — simple moderation primitives.

import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { COLORS } from '../utils/config.js';

export const ban = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason'))
    .addIntegerOption((o) =>
      o.setName('delete-days').setDescription('Delete messages from last N days (0–7)')
        .setMinValue(0).setMaxValue(7)),
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const days = interaction.options.getInteger('delete-days') ?? 0;

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member && !member.bannable) {
      return interaction.reply({ content: '❌ I cannot ban that user.', ephemeral: true });
    }

    await interaction.guild.bans.create(user.id, {
      reason: `${reason} | by ${interaction.user.tag}`,
      deleteMessageSeconds: days * 86400,
    });

    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.error).setTitle('🔨 Banned')
        .setDescription(`**${user.tag}** has been banned.\n**Reason:** ${reason}`)],
    });
  },
};

export const kick = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason')),
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not in guild.', ephemeral: true });
    if (!member.kickable) return interaction.reply({ content: '❌ I cannot kick that user.', ephemeral: true });

    await member.kick(`${reason} | by ${interaction.user.tag}`);
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.warn).setTitle('👢 Kicked')
        .setDescription(`**${user.tag}** has been kicked.\n**Reason:** ${reason}`)],
    });
  },
};

export const timeout = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Time out a member (mute)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to timeout').setRequired(true))
    .addIntegerOption((o) =>
      o.setName('minutes').setDescription('Duration in minutes (0 to remove)')
        .setMinValue(0).setMaxValue(40320 /* 28d */).setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason')),
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const minutes = interaction.options.getInteger('minutes', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ User not in guild.', ephemeral: true });
    if (!member.moderatable) return interaction.reply({ content: '❌ I cannot timeout that user.', ephemeral: true });

    await member.timeout(minutes === 0 ? null : minutes * 60_000,
      `${reason} | by ${interaction.user.tag}`);

    const title = minutes === 0 ? '🔓 Timeout removed' : '🔇 Timed out';
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLORS.warn).setTitle(title)
        .setDescription(`**${user.tag}** ${minutes === 0
          ? 'is no longer timed out.' : `for **${minutes} minutes**.`}\n**Reason:** ${reason}`)],
    });
  },
};

// Default export = array so the command loader can iterate.
export default [ban, kick, timeout];
