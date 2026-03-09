"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTOACCEPT_BTN_REFRESH = exports.AUTOACCEPT_BTN_OFF = exports.AUTOACCEPT_BTN_ON = void 0;
exports.buildAutoAcceptPayload = buildAutoAcceptPayload;
exports.sendAutoAcceptUI = sendAutoAcceptUI;
const discord_js_1 = require("discord.js");
const richContentBuilder_1 = require("../platform/richContentBuilder");
exports.AUTOACCEPT_BTN_ON = 'autoaccept_btn_on';
exports.AUTOACCEPT_BTN_OFF = 'autoaccept_btn_off';
exports.AUTOACCEPT_BTN_REFRESH = 'autoaccept_btn_refresh';
/**
 * Build a platform-agnostic MessagePayload for auto-accept UI.
 */
function buildAutoAcceptPayload(enabled) {
    const rc = (0, richContentBuilder_1.withTimestamp)((0, richContentBuilder_1.withFooter)((0, richContentBuilder_1.withDescription)((0, richContentBuilder_1.withColor)((0, richContentBuilder_1.withTitle)((0, richContentBuilder_1.createRichContent)(), 'Auto-accept Management'), enabled ? 0x2ECC71 : 0x95A5A6), `**Current Status:** ${enabled ? 'ON' : 'OFF'}\n\n` +
        'ON: approval dialogs are automatically allowed.\n' +
        'OFF: approval dialogs require manual action.'), 'Use buttons below to change mode'));
    return {
        richContent: rc,
        components: [
            {
                components: [
                    {
                        type: 'button',
                        customId: exports.AUTOACCEPT_BTN_ON,
                        label: 'Turn ON',
                        style: enabled ? 'success' : 'secondary',
                    },
                    {
                        type: 'button',
                        customId: exports.AUTOACCEPT_BTN_OFF,
                        label: 'Turn OFF',
                        style: !enabled ? 'danger' : 'secondary',
                    },
                    {
                        type: 'button',
                        customId: exports.AUTOACCEPT_BTN_REFRESH,
                        label: 'Refresh',
                        style: 'primary',
                    },
                ],
            },
        ],
    };
}
async function sendAutoAcceptUI(target, autoAcceptService) {
    const enabled = autoAcceptService.isEnabled();
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('Auto-accept Management')
        .setColor(enabled ? 0x2ECC71 : 0x95A5A6)
        .setDescription(`**Current Status:** ${enabled ? '🟢 ON' : '⚪ OFF'}\n\n` +
        'ON: approval dialogs are automatically allowed.\n' +
        'OFF: approval dialogs require manual action.')
        .setFooter({ text: 'Use buttons below to change mode' })
        .setTimestamp();
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(exports.AUTOACCEPT_BTN_ON)
        .setLabel('Turn ON')
        .setStyle(enabled ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId(exports.AUTOACCEPT_BTN_OFF)
        .setLabel('Turn OFF')
        .setStyle(!enabled ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId(exports.AUTOACCEPT_BTN_REFRESH)
        .setLabel('Refresh')
        .setStyle(discord_js_1.ButtonStyle.Primary));
    await target.editReply({
        content: '',
        embeds: [embed],
        components: [row],
    });
}
