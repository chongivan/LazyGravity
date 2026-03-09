"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildModelsPayload = buildModelsPayload;
exports.buildModelsUI = buildModelsUI;
exports.sendModelsUI = sendModelsUI;
const discord_js_1 = require("discord.js");
const richContentBuilder_1 = require("../platform/richContentBuilder");
/**
 * Build a platform-agnostic MessagePayload for model selection UI.
 */
function buildModelsPayload(models, currentModel, quotaData, defaultModel = null) {
    if (models.length === 0)
        return null;
    function formatQuota(mName, current) {
        if (!mName)
            return `${current ? '[x]' : '[ ]'} Unknown`;
        const normalize = (s) => s.toLowerCase().replace(/[\s\-_]/g, '');
        const nName = normalize(mName);
        const q = quotaData.find(q => {
            const nLabel = normalize(q.label);
            const nModel = normalize(q.model || '');
            return nLabel === nName || nModel === nName
                || nName.includes(nLabel) || nLabel.includes(nName)
                || (nModel && (nName.includes(nModel) || nModel.includes(nName)));
        });
        if (!q || !q.quotaInfo)
            return `${current ? '[x]' : '[ ]'} ${mName}`;
        const rem = q.quotaInfo.remainingFraction;
        const resetTime = q.quotaInfo.resetTime ? new Date(q.quotaInfo.resetTime) : null;
        const diffMs = resetTime ? resetTime.getTime() - Date.now() : 0;
        let timeStr = 'Ready';
        if (diffMs > 0) {
            const mins = Math.ceil(diffMs / 60000);
            if (mins < 60)
                timeStr = `${mins}m`;
            else
                timeStr = `${Math.floor(mins / 60)}h ${mins % 60}m`;
        }
        if (rem !== undefined && rem !== null) {
            const percent = Math.round(rem * 100);
            return `${current ? '[x]' : '[ ]'} ${mName} ${percent}% (${timeStr})`;
        }
        return `${current ? '[x]' : '[ ]'} ${mName} (${timeStr})`;
    }
    const currentModelFormatted = currentModel ? formatQuota(currentModel, true) : 'Unknown';
    const defaultLine = defaultModel
        ? `\n**Default:** ⭐ ${defaultModel}`
        : '\n**Default:** Not set';
    const modelLines = models.map(m => {
        const isCurrent = m === currentModel;
        const isDefault = defaultModel != null && m.toLowerCase() === defaultModel.toLowerCase();
        const star = isDefault ? ' ⭐' : '';
        return `${formatQuota(m, isCurrent)}${star}`;
    }).join('\n');
    const rc = (0, richContentBuilder_1.withTimestamp)((0, richContentBuilder_1.withFooter)((0, richContentBuilder_1.withDescription)((0, richContentBuilder_1.withColor)((0, richContentBuilder_1.withTitle)((0, richContentBuilder_1.createRichContent)(), 'Model Management'), 0x5865F2), `**Current Model:**\n${currentModelFormatted}${defaultLine}\n\n` +
        `**Available Models (${models.length})**\n` +
        modelLines), 'Latest quota information retrieved'));
    // Use 1 button per row so model names are fully readable on Telegram.
    // Telegram inline keyboard buttons are narrow; 5-per-row truncates names.
    const rows = [];
    for (const mName of models.slice(0, 24)) {
        const safeName = mName.length > 80 ? mName.substring(0, 77) + '...' : mName;
        const isDefault = defaultModel != null && mName.toLowerCase() === defaultModel.toLowerCase();
        const prefix = mName === currentModel ? '✓ ' : '';
        const suffix = isDefault ? ' ⭐' : '';
        rows.push({
            components: [{
                    type: 'button',
                    customId: `model_btn_${mName}`,
                    label: `${prefix}${safeName}${suffix}`,
                    style: mName === currentModel ? 'success' : 'secondary',
                }],
        });
    }
    // Default model action buttons
    const defaultBtnRow = {
        components: defaultModel
            ? [{
                    type: 'button',
                    customId: 'model_clear_default_btn',
                    label: 'Clear Default',
                    style: 'danger',
                }]
            : [{
                    type: 'button',
                    customId: 'model_set_default_btn',
                    label: 'Set Current as Default',
                    style: 'primary',
                }],
    };
    rows.push(defaultBtnRow);
    rows.push({
        components: [{
                type: 'button',
                customId: 'model_refresh_btn',
                label: 'Refresh',
                style: 'primary',
            }],
    });
    return { richContent: rc, components: rows };
}
/**
 * Build the embed + button components for the models UI.
 * Returns null when CDP is unavailable or no models are found.
 */
async function buildModelsUI(cdp, fetchQuota) {
    const models = await cdp.getUiModels();
    const currentModel = await cdp.getCurrentModel();
    const quotaData = await fetchQuota();
    if (models.length === 0)
        return null;
    function formatQuota(mName, current) {
        if (!mName)
            return `${current ? '[x]' : '[ ]'} Unknown`;
        const normalize = (s) => s.toLowerCase().replace(/[\s\-_]/g, '');
        const nName = normalize(mName);
        const q = quotaData.find(q => {
            const nLabel = normalize(q.label);
            const nModel = normalize(q.model || '');
            return nLabel === nName || nModel === nName
                || nName.includes(nLabel) || nLabel.includes(nName)
                || (nModel && (nName.includes(nModel) || nModel.includes(nName)));
        });
        if (!q || !q.quotaInfo)
            return `${current ? '[x]' : '[ ]'} ${mName}`;
        const rem = q.quotaInfo.remainingFraction;
        const resetTime = q.quotaInfo.resetTime ? new Date(q.quotaInfo.resetTime) : null;
        const diffMs = resetTime ? resetTime.getTime() - Date.now() : 0;
        let timeStr = 'Ready';
        if (diffMs > 0) {
            const mins = Math.ceil(diffMs / 60000);
            if (mins < 60)
                timeStr = `${mins}m`;
            else
                timeStr = `${Math.floor(mins / 60)}h ${mins % 60}m`;
        }
        if (rem !== undefined && rem !== null) {
            const percent = Math.round(rem * 100);
            let icon = '🟢';
            if (percent <= 20)
                icon = '🔴';
            else if (percent <= 50)
                icon = '🟡';
            return `${current ? '[x]' : '[ ]'} ${mName} ${icon} ${percent}% (⏱️ ${timeStr})`;
        }
        return `${current ? '[x]' : '[ ]'} ${mName} (⏱️ ${timeStr})`;
    }
    const currentModelFormatted = currentModel ? formatQuota(currentModel, true) : 'Unknown';
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('Model Management')
        .setColor(0x5865F2)
        .setDescription(`**Current Model:**\n${currentModelFormatted}\n\n` +
        `**Available Models (${models.length})**\n` +
        models.map(m => formatQuota(m, m === currentModel)).join('\n'))
        .setFooter({ text: 'Latest quota information retrieved' })
        .setTimestamp();
    const rows = [];
    let currentRow = new discord_js_1.ActionRowBuilder();
    for (const mName of models.slice(0, 24)) {
        if (currentRow.components.length === 5) {
            rows.push(currentRow);
            currentRow = new discord_js_1.ActionRowBuilder();
        }
        const safeName = mName.length > 80 ? mName.substring(0, 77) + '...' : mName;
        currentRow.addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`model_btn_${mName}`)
            .setLabel(safeName)
            .setStyle(mName === currentModel ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary));
    }
    if (currentRow.components.length < 5) {
        currentRow.addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId('model_refresh_btn')
            .setLabel('Refresh')
            .setStyle(discord_js_1.ButtonStyle.Primary));
        rows.push(currentRow);
    }
    else {
        rows.push(currentRow);
        if (rows.length < 5) {
            const refreshRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId('model_refresh_btn')
                .setLabel('Refresh')
                .setStyle(discord_js_1.ButtonStyle.Primary));
            rows.push(refreshRow);
        }
    }
    return { embeds: [embed], components: rows };
}
/**
 * Build and send the interactive UI for the /models command
 */
async function sendModelsUI(target, deps) {
    const cdp = deps.getCurrentCdp();
    if (!cdp) {
        await target.editReply({ content: 'Not connected to CDP.' });
        return;
    }
    const payload = await buildModelsUI(cdp, deps.fetchQuota);
    if (!payload) {
        await target.editReply({ content: 'Failed to retrieve model list from Antigravity.' });
        return;
    }
    await target.editReply({ content: '', ...payload });
}
