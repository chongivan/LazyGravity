"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_SELECT_ID = void 0;
exports.isSessionSelectId = isSessionSelectId;
exports.buildSessionPickerPayload = buildSessionPickerPayload;
exports.buildSessionPickerUI = buildSessionPickerUI;
const discord_js_1 = require("discord.js");
const i18n_1 = require("../utils/i18n");
const richContentBuilder_1 = require("../platform/richContentBuilder");
/** Select menu custom ID for session picker */
exports.SESSION_SELECT_ID = 'session_select';
/** Maximum items per select menu (Discord limit) */
const MAX_SELECT_OPTIONS = 25;
/**
 * Check if a customId belongs to the session select menu.
 */
function isSessionSelectId(customId) {
    return customId === exports.SESSION_SELECT_ID;
}
/**
 * Build a platform-agnostic MessagePayload for session picker UI.
 */
function buildSessionPickerPayload(sessions) {
    const MAX_OPTIONS = 25;
    let rc = (0, richContentBuilder_1.withTimestamp)((0, richContentBuilder_1.withColor)((0, richContentBuilder_1.withTitle)((0, richContentBuilder_1.createRichContent)(), (0, i18n_1.t)('Join Session')), 0x5865F2));
    if (sessions.length === 0) {
        rc = (0, richContentBuilder_1.withDescription)(rc, (0, i18n_1.t)('No sessions found in the Antigravity side panel.'));
        return { richContent: rc, components: [] };
    }
    rc = (0, richContentBuilder_1.withDescription)(rc, (0, i18n_1.t)('Select a session to join ({{count}} found)', { count: sessions.length }));
    const pageItems = sessions.slice(0, MAX_OPTIONS);
    return {
        richContent: rc,
        components: [
            {
                components: [
                    {
                        type: 'selectMenu',
                        customId: exports.SESSION_SELECT_ID,
                        placeholder: (0, i18n_1.t)('Select a session...'),
                        options: pageItems.map((session) => ({
                            label: session.title.slice(0, 100),
                            value: session.title.slice(0, 100),
                            description: session.isActive ? (0, i18n_1.t)('Current') : undefined,
                        })),
                    },
                ],
            },
        ],
    };
}
/**
 * Build the session picker UI with a select menu.
 *
 * @param sessions - List of sessions from the side panel
 * @returns Object with embeds and components arrays ready for Discord reply
 */
function buildSessionPickerUI(sessions) {
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle((0, i18n_1.t)('🔗 Join Session'))
        .setColor(0x5865F2)
        .setTimestamp();
    if (sessions.length === 0) {
        embed.setDescription((0, i18n_1.t)('No sessions found in the Antigravity side panel.'));
        return { embeds: [embed], components: [] };
    }
    embed.setDescription((0, i18n_1.t)('Select a session to join ({{count}} found)', { count: sessions.length }));
    const pageItems = sessions.slice(0, MAX_SELECT_OPTIONS);
    const options = pageItems.map((session) => ({
        label: session.title.slice(0, 100),
        value: session.title.slice(0, 100),
        description: session.isActive ? (0, i18n_1.t)('Current') : undefined,
    }));
    const selectMenu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(exports.SESSION_SELECT_ID)
        .setPlaceholder((0, i18n_1.t)('Select a session...'))
        .addOptions(options);
    const components = [
        new discord_js_1.ActionRowBuilder().addComponents(selectMenu),
    ];
    return { embeds: [embed], components };
}
