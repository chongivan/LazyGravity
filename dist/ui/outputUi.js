"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OUTPUT_BTN_PLAIN = exports.OUTPUT_BTN_EMBED = void 0;
exports.buildOutputPayload = buildOutputPayload;
exports.sendOutputUI = sendOutputUI;
const discord_js_1 = require("discord.js");
const richContentBuilder_1 = require("../platform/richContentBuilder");
exports.OUTPUT_BTN_EMBED = 'output_btn_embed';
exports.OUTPUT_BTN_PLAIN = 'output_btn_plain';
/**
 * Build a platform-agnostic MessagePayload for output format UI.
 */
function buildOutputPayload(currentFormat) {
    const isEmbed = currentFormat === 'embed';
    const rc = (0, richContentBuilder_1.withTimestamp)((0, richContentBuilder_1.withFooter)((0, richContentBuilder_1.withDescription)((0, richContentBuilder_1.withColor)((0, richContentBuilder_1.withTitle)((0, richContentBuilder_1.createRichContent)(), 'Output Format'), isEmbed ? 0x5865F2 : 0x2ECC71), `**Current Format:** ${isEmbed ? 'Embed' : 'Plain Text'}\n\n` +
        'Embed: Rich formatting with colored borders (default).\n' +
        'Plain Text: Simple text output, easy to copy on mobile.'), 'Use buttons below to change format'));
    return {
        richContent: rc,
        components: [
            {
                components: [
                    {
                        type: 'button',
                        customId: exports.OUTPUT_BTN_EMBED,
                        label: 'Embed',
                        style: isEmbed ? 'primary' : 'secondary',
                    },
                    {
                        type: 'button',
                        customId: exports.OUTPUT_BTN_PLAIN,
                        label: 'Plain Text',
                        style: !isEmbed ? 'success' : 'secondary',
                    },
                ],
            },
        ],
    };
}
async function sendOutputUI(target, currentFormat) {
    const isEmbed = currentFormat === 'embed';
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('Output Format')
        .setColor(isEmbed ? 0x5865F2 : 0x2ECC71)
        .setDescription(`**Current Format:** ${isEmbed ? '📋 Embed' : '📝 Plain Text'}\n\n` +
        'Embed: Rich formatting with colored borders (default).\n' +
        'Plain Text: Simple text output, easy to copy on mobile.')
        .setFooter({ text: 'Use buttons below to change format' })
        .setTimestamp();
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(exports.OUTPUT_BTN_EMBED)
        .setLabel('Embed')
        .setStyle(isEmbed ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId(exports.OUTPUT_BTN_PLAIN)
        .setLabel('Plain Text')
        .setStyle(!isEmbed ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary));
    await target.editReply({
        content: '',
        embeds: [embed],
        components: [row],
    });
}
