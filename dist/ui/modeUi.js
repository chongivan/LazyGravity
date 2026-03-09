"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildModePayload = buildModePayload;
exports.sendModeUI = sendModeUI;
const discord_js_1 = require("discord.js");
const modeService_1 = require("../services/modeService");
const richContentBuilder_1 = require("../platform/richContentBuilder");
/**
 * Build a platform-agnostic MessagePayload for mode selection UI.
 * @param currentMode The current mode name
 * @param isPending Whether the mode is pending sync to Antigravity
 */
function buildModePayload(currentMode, isPending = false) {
    const pendingSuffix = isPending ? ' (pending sync)' : '';
    const rc = (0, richContentBuilder_1.withTimestamp)((0, richContentBuilder_1.withFooter)((0, richContentBuilder_1.withDescription)((0, richContentBuilder_1.withColor)((0, richContentBuilder_1.withTitle)((0, richContentBuilder_1.createRichContent)(), 'Mode Management'), 0x57F287), `**Current Mode:** ${modeService_1.MODE_DISPLAY_NAMES[currentMode] || currentMode}${pendingSuffix}\n` +
        `${modeService_1.MODE_DESCRIPTIONS[currentMode] || ''}\n\n` +
        `**Available Modes (${modeService_1.AVAILABLE_MODES.length})**\n` +
        modeService_1.AVAILABLE_MODES.map(m => {
            const icon = m === currentMode ? '[x]' : '[ ]';
            return `${icon} **${modeService_1.MODE_DISPLAY_NAMES[m] || m}** — ${modeService_1.MODE_DESCRIPTIONS[m] || ''}`;
        }).join('\n')), 'Select a mode from the dropdown below'));
    return {
        richContent: rc,
        components: [
            {
                components: [
                    {
                        type: 'selectMenu',
                        customId: 'mode_select',
                        placeholder: 'Select a mode...',
                        options: modeService_1.AVAILABLE_MODES.map(m => ({
                            label: modeService_1.MODE_DISPLAY_NAMES[m] || m,
                            description: modeService_1.MODE_DESCRIPTIONS[m] || '',
                            value: m,
                            isDefault: m === currentMode,
                        })),
                    },
                ],
            },
        ],
    };
}
/**
 * Build and send the interactive UI for the /mode command (dropdown style)
 */
async function sendModeUI(target, modeService, deps) {
    // If CDP is available, query the live mode and sync modeService
    if (deps?.getCurrentCdp) {
        const cdp = deps.getCurrentCdp();
        if (cdp) {
            const liveMode = await cdp.getCurrentMode();
            if (liveMode) {
                modeService.setMode(liveMode, true);
            }
        }
    }
    const currentMode = modeService.getCurrentMode();
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('Mode Management')
        .setColor(0x57F287)
        .setDescription(`**Current Mode:** ${modeService_1.MODE_DISPLAY_NAMES[currentMode] || currentMode}\n` +
        `${modeService_1.MODE_DESCRIPTIONS[currentMode] || ''}\n\n` +
        `**Available Modes (${modeService_1.AVAILABLE_MODES.length})**\n` +
        modeService_1.AVAILABLE_MODES.map(m => {
            const icon = m === currentMode ? '[x]' : '[ ]';
            return `${icon} **${modeService_1.MODE_DISPLAY_NAMES[m] || m}** — ${modeService_1.MODE_DESCRIPTIONS[m] || ''}`;
        }).join('\n'))
        .setFooter({ text: 'Select a mode from the dropdown below' })
        .setTimestamp();
    const selectMenu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId('mode_select')
        .setPlaceholder('Select a mode...')
        .addOptions(modeService_1.AVAILABLE_MODES.map(m => ({
        label: modeService_1.MODE_DISPLAY_NAMES[m] || m,
        description: modeService_1.MODE_DESCRIPTIONS[m] || '',
        value: m,
        default: m === currentMode,
    })));
    const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
    await target.editReply({ content: '', embeds: [embed], components: [row] });
}
