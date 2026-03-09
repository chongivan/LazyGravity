"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEMPLATE_BTN_PREFIX = void 0;
exports.parseTemplateButtonId = parseTemplateButtonId;
exports.buildTemplatePayload = buildTemplatePayload;
exports.sendTemplateUI = sendTemplateUI;
const discord_js_1 = require("discord.js");
const richContentBuilder_1 = require("../platform/richContentBuilder");
/** Button customId prefix. Format: template_btn_<id> */
exports.TEMPLATE_BTN_PREFIX = 'template_btn_';
const MAX_PROMPT_PREVIEW_LEN = 60;
const MAX_BUTTONS = 25;
/**
 * Extract template ID from a button customId.
 * Returns NaN if the customId does not match the expected format.
 */
function parseTemplateButtonId(customId) {
    if (!customId.startsWith(exports.TEMPLATE_BTN_PREFIX))
        return NaN;
    return parseInt(customId.slice(exports.TEMPLATE_BTN_PREFIX.length), 10);
}
/**
 * Build a platform-agnostic MessagePayload for template list UI.
 */
function buildTemplatePayload(templates) {
    if (templates.length === 0) {
        const rc = (0, richContentBuilder_1.withTimestamp)((0, richContentBuilder_1.withDescription)((0, richContentBuilder_1.withColor)((0, richContentBuilder_1.withTitle)((0, richContentBuilder_1.createRichContent)(), 'Template Management'), 0x57F287), 'No templates registered.\n\n' +
            'Use `/template add name:<name> prompt:<prompt>` to add one.'));
        return { richContent: rc, components: [] };
    }
    const truncate = (text, max) => text.length > max ? `${text.substring(0, max - 3)}...` : text;
    const displayTemplates = templates.slice(0, MAX_BUTTONS);
    const hasMore = templates.length > MAX_BUTTONS;
    const description = displayTemplates
        .map((tpl, i) => `**${i + 1}. ${tpl.name}**\n> ${truncate(tpl.prompt, MAX_PROMPT_PREVIEW_LEN)}`)
        .join('\n\n');
    const footerText = hasMore
        ? `${templates.length - MAX_BUTTONS} templates are hidden. Use /template use <name> to execute directly.`
        : 'Click a button to execute the template';
    const rc = (0, richContentBuilder_1.withTimestamp)((0, richContentBuilder_1.withFooter)((0, richContentBuilder_1.withDescription)((0, richContentBuilder_1.withColor)((0, richContentBuilder_1.withTitle)((0, richContentBuilder_1.createRichContent)(), 'Template Management'), 0x57F287), `**Registered Templates (${templates.length})**\n\n${description}`), footerText));
    const rows = [];
    let currentButtons = [];
    for (const tpl of displayTemplates) {
        if (currentButtons.length === 5) {
            rows.push({ components: currentButtons });
            currentButtons = [];
        }
        const safeLabel = tpl.name.length > 80 ? `${tpl.name.substring(0, 77)}...` : tpl.name;
        currentButtons.push({
            type: 'button',
            customId: `${exports.TEMPLATE_BTN_PREFIX}${tpl.id}`,
            label: safeLabel,
            style: 'primary',
        });
    }
    if (currentButtons.length > 0) {
        rows.push({ components: currentButtons });
    }
    return { richContent: rc, components: rows };
}
/**
 * Build and send the template list UI with clickable buttons.
 * Follows the same pattern as modelsUi.ts.
 */
async function sendTemplateUI(target, templates) {
    if (templates.length === 0) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('Template Management')
            .setColor(0x57F287)
            .setDescription('No templates registered.\n\n' +
            'Use `/template add name:<name> prompt:<prompt>` to add one.')
            .setTimestamp();
        await target.editReply({ content: '', embeds: [embed], components: [] });
        return;
    }
    const truncate = (text, max) => text.length > max ? `${text.substring(0, max - 3)}...` : text;
    const displayTemplates = templates.slice(0, MAX_BUTTONS);
    const hasMore = templates.length > MAX_BUTTONS;
    const description = displayTemplates
        .map((tpl, i) => `**${i + 1}. ${tpl.name}**\n> ${truncate(tpl.prompt, MAX_PROMPT_PREVIEW_LEN)}`)
        .join('\n\n');
    const footerText = hasMore
        ? `${templates.length - MAX_BUTTONS} templates are hidden. Use /template use <name> to execute directly.`
        : 'Click a button to execute the template';
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('Template Management')
        .setColor(0x57F287)
        .setDescription(`**Registered Templates (${templates.length})**\n\n${description}`)
        .setFooter({ text: footerText })
        .setTimestamp();
    const rows = [];
    let currentRow = new discord_js_1.ActionRowBuilder();
    for (const tpl of displayTemplates) {
        if (currentRow.components.length === 5) {
            rows.push(currentRow);
            currentRow = new discord_js_1.ActionRowBuilder();
        }
        const safeLabel = tpl.name.length > 80 ? `${tpl.name.substring(0, 77)}...` : tpl.name;
        currentRow.addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`${exports.TEMPLATE_BTN_PREFIX}${tpl.id}`)
            .setLabel(safeLabel)
            .setStyle(discord_js_1.ButtonStyle.Primary));
    }
    if (currentRow.components.length > 0) {
        rows.push(currentRow);
    }
    await target.editReply({ content: '', embeds: [embed], components: rows });
}
