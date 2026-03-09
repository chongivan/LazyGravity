"use strict";
/**
 * Wrapper functions to convert discord.js types to/from platform types.
 *
 * These functions form the boundary between the discord.js library and
 * the platform-agnostic core. All conversions are pure (no mutation).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDiscordButtonStyle = toDiscordButtonStyle;
exports.toDiscordPayload = toDiscordPayload;
exports.wrapDiscordUser = wrapDiscordUser;
exports.wrapDiscordSentMessage = wrapDiscordSentMessage;
exports.wrapDiscordChannel = wrapDiscordChannel;
exports.wrapDiscordMessage = wrapDiscordMessage;
exports.wrapDiscordButton = wrapDiscordButton;
exports.wrapDiscordSelect = wrapDiscordSelect;
exports.wrapDiscordCommand = wrapDiscordCommand;
const discord_js_1 = require("discord.js");
// ---------------------------------------------------------------------------
// Style mapping
// ---------------------------------------------------------------------------
const BUTTON_STYLE_MAP = {
    primary: discord_js_1.ButtonStyle.Primary,
    secondary: discord_js_1.ButtonStyle.Secondary,
    success: discord_js_1.ButtonStyle.Success,
    danger: discord_js_1.ButtonStyle.Danger,
};
/** Map a platform ButtonStyle to its discord.js equivalent. */
function toDiscordButtonStyle(style) {
    return BUTTON_STYLE_MAP[style];
}
// ---------------------------------------------------------------------------
// Payload conversion
// ---------------------------------------------------------------------------
/**
 * Convert a platform RichContent to a discord.js EmbedBuilder.
 * Returns a new EmbedBuilder instance.
 */
function toDiscordEmbed(rc) {
    const embed = new discord_js_1.EmbedBuilder();
    if (rc.title !== undefined) {
        embed.setTitle(rc.title);
    }
    if (rc.description !== undefined) {
        embed.setDescription(rc.description);
    }
    if (rc.color !== undefined) {
        embed.setColor(rc.color);
    }
    if (rc.fields !== undefined) {
        for (const field of rc.fields) {
            embed.addFields({ name: field.name, value: field.value, inline: field.inline });
        }
    }
    if (rc.footer !== undefined) {
        embed.setFooter({ text: rc.footer });
    }
    if (rc.timestamp !== undefined) {
        embed.setTimestamp(rc.timestamp);
    }
    if (rc.thumbnailUrl !== undefined) {
        embed.setThumbnail(rc.thumbnailUrl);
    }
    if (rc.imageUrl !== undefined) {
        embed.setImage(rc.imageUrl);
    }
    return embed;
}
/**
 * Convert platform ComponentRow[] to discord.js ActionRowBuilder[].
 * Each row produces one ActionRowBuilder containing buttons or a select menu.
 */
function toDiscordComponents(rows) {
    return rows.map((row) => {
        const hasButton = row.components.some((c) => c.type === 'button');
        const hasSelect = row.components.some((c) => c.type === 'selectMenu');
        if (hasButton && hasSelect) {
            throw new Error('Discord does not allow mixing buttons and select menus in the same ActionRow.');
        }
        const actionRow = new discord_js_1.ActionRowBuilder();
        for (const comp of row.components) {
            if (comp.type === 'button') {
                const button = new discord_js_1.ButtonBuilder()
                    .setCustomId(comp.customId)
                    .setLabel(comp.label)
                    .setStyle(toDiscordButtonStyle(comp.style));
                if (comp.disabled === true) {
                    button.setDisabled(true);
                }
                actionRow.addComponents(button);
            }
            else if (comp.type === 'selectMenu') {
                const select = new discord_js_1.StringSelectMenuBuilder()
                    .setCustomId(comp.customId)
                    .addOptions(comp.options.map((opt) => ({
                    label: opt.label,
                    value: opt.value,
                    description: opt.description,
                    default: opt.isDefault,
                })));
                if (comp.placeholder !== undefined) {
                    select.setPlaceholder(comp.placeholder);
                }
                actionRow.addComponents(select);
            }
        }
        return actionRow;
    });
}
/**
 * Convert a platform MessagePayload to discord.js message send/reply options.
 *
 * This is the central conversion point used by wrapDiscordChannel.send(),
 * wrapDiscordMessage.reply(), and interaction reply/update methods.
 *
 * @param payload  The platform-agnostic message payload.
 * @param opts     Conversion options. Only interaction callers should set
 *                 `allowEphemeral: true`.
 */
function toDiscordPayload(payload, opts = {}) {
    const result = {};
    if (payload.text !== undefined) {
        result.content = payload.text;
    }
    if (payload.richContent !== undefined) {
        result.embeds = [toDiscordEmbed(payload.richContent)];
    }
    if (payload.components !== undefined && payload.components.length > 0) {
        result.components = toDiscordComponents(payload.components);
    }
    if (payload.files !== undefined && payload.files.length > 0) {
        result.files = payload.files.map((f) => new discord_js_1.AttachmentBuilder(f.data, { name: f.name }));
    }
    if (opts.allowEphemeral === true && payload.ephemeral === true) {
        result.flags = discord_js_1.MessageFlags.Ephemeral;
    }
    return result;
}
/** Reusable opts constant for interaction callers that allow ephemeral. */
const EPHEMERAL_ALLOWED = Object.freeze({ allowEphemeral: true });
/**
 * Build a minimal PlatformChannel fallback when `interaction.channel` is null
 * (e.g. DMs or uncached channels). Uses `interaction.channelId` which is
 * always available as a string.
 */
function buildFallbackChannel(channelId) {
    return {
        id: channelId,
        platform: 'discord',
        name: undefined,
        async send() {
            throw new Error(`Cannot send to channel ${channelId}: channel object is not available (DM or uncached)`);
        },
    };
}
// ---------------------------------------------------------------------------
// Entity wrappers
// ---------------------------------------------------------------------------
/** Wrap a discord.js User as a PlatformUser. */
function wrapDiscordUser(user) {
    return {
        id: user.id,
        platform: 'discord',
        username: user.username,
        displayName: user.displayName ?? undefined,
        isBot: user.bot,
    };
}
/** Wrap a discord.js Message as a PlatformSentMessage (for edit/delete). */
function wrapDiscordSentMessage(msg) {
    return {
        id: msg.id,
        platform: 'discord',
        channelId: msg.channelId,
        async edit(payload) {
            const edited = await msg.edit(toDiscordPayload(payload));
            return wrapDiscordSentMessage(edited);
        },
        async delete() {
            await msg.delete();
        },
    };
}
/** Wrap a discord.js TextChannel (or any channel with send()) as a PlatformChannel. */
function wrapDiscordChannel(channel) {
    return {
        id: channel.id,
        platform: 'discord',
        name: 'name' in channel ? channel.name : undefined,
        async send(payload) {
            const sent = await channel.send(toDiscordPayload(payload));
            return wrapDiscordSentMessage(sent);
        },
    };
}
/** Convert discord.js message attachments to PlatformAttachment[]. */
function toAttachments(msg) {
    return [...msg.attachments.values()].map((a) => ({
        name: a.name,
        contentType: a.contentType,
        url: a.url,
        size: a.size,
    }));
}
/** Wrap a discord.js Message as a PlatformMessage. */
function wrapDiscordMessage(message) {
    const author = wrapDiscordUser(message.author);
    const channel = wrapDiscordChannel(message.channel);
    const attachments = toAttachments(message);
    return {
        id: message.id,
        platform: 'discord',
        content: message.content,
        author,
        channel,
        attachments,
        createdAt: message.createdAt,
        async react(emoji) {
            await message.react(emoji);
        },
        async reply(payload) {
            const sent = await message.reply(toDiscordPayload(payload));
            return wrapDiscordSentMessage(sent);
        },
    };
}
// ---------------------------------------------------------------------------
// Interaction wrappers
// ---------------------------------------------------------------------------
/** Wrap a discord.js ButtonInteraction as a PlatformButtonInteraction. */
function wrapDiscordButton(interaction) {
    const user = wrapDiscordUser(interaction.user);
    const channel = interaction.channel
        ? wrapDiscordChannel(interaction.channel)
        : buildFallbackChannel(interaction.channelId);
    return {
        id: interaction.id,
        platform: 'discord',
        customId: interaction.customId,
        user,
        channel,
        messageId: interaction.message.id,
        async deferUpdate() {
            await interaction.deferUpdate();
        },
        async reply(payload) {
            await interaction.reply(toDiscordPayload(payload, EPHEMERAL_ALLOWED));
        },
        async update(payload) {
            await interaction.update(toDiscordPayload(payload, EPHEMERAL_ALLOWED));
        },
        async editReply(payload) {
            await interaction.editReply(toDiscordPayload(payload, EPHEMERAL_ALLOWED));
        },
        async followUp(payload) {
            const sent = await interaction.followUp(toDiscordPayload(payload, EPHEMERAL_ALLOWED));
            return wrapDiscordSentMessage(sent);
        },
    };
}
/** Wrap a discord.js StringSelectMenuInteraction as a PlatformSelectInteraction. */
function wrapDiscordSelect(interaction) {
    const user = wrapDiscordUser(interaction.user);
    const channel = interaction.channel
        ? wrapDiscordChannel(interaction.channel)
        : buildFallbackChannel(interaction.channelId);
    return {
        id: interaction.id,
        platform: 'discord',
        customId: interaction.customId,
        user,
        channel,
        values: interaction.values,
        messageId: interaction.message.id,
        async deferUpdate() {
            await interaction.deferUpdate();
        },
        async reply(payload) {
            await interaction.reply(toDiscordPayload(payload, EPHEMERAL_ALLOWED));
        },
        async update(payload) {
            await interaction.update(toDiscordPayload(payload, EPHEMERAL_ALLOWED));
        },
        async editReply(payload) {
            await interaction.editReply(toDiscordPayload(payload, EPHEMERAL_ALLOWED));
        },
        async followUp(payload) {
            const sent = await interaction.followUp(toDiscordPayload(payload, EPHEMERAL_ALLOWED));
            return wrapDiscordSentMessage(sent);
        },
    };
}
/** Extract command options from a ChatInputCommandInteraction into a ReadonlyMap. */
function extractCommandOptions(interaction) {
    const map = new Map();
    for (const opt of interaction.options.data) {
        if (opt.value !== undefined && opt.value !== null) {
            map.set(opt.name, opt.value);
        }
    }
    return map;
}
/** Wrap a discord.js ChatInputCommandInteraction as a PlatformCommandInteraction. */
function wrapDiscordCommand(interaction) {
    const user = wrapDiscordUser(interaction.user);
    const channel = interaction.channel
        ? wrapDiscordChannel(interaction.channel)
        : buildFallbackChannel(interaction.channelId);
    const options = extractCommandOptions(interaction);
    return {
        id: interaction.id,
        platform: 'discord',
        commandName: interaction.commandName,
        user,
        channel,
        options,
        async deferReply(opts) {
            await interaction.deferReply({ flags: opts?.ephemeral ? discord_js_1.MessageFlags.Ephemeral : undefined });
        },
        async reply(payload) {
            await interaction.reply(toDiscordPayload(payload, EPHEMERAL_ALLOWED));
        },
        async editReply(payload) {
            await interaction.editReply(toDiscordPayload(payload, EPHEMERAL_ALLOWED));
        },
        async followUp(payload) {
            const sent = await interaction.followUp(toDiscordPayload(payload, EPHEMERAL_ALLOWED));
            return wrapDiscordSentMessage(sent);
        },
    };
}
