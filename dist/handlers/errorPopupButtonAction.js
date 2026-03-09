"use strict";
/**
 * Platform-agnostic error popup button action.
 *
 * Handles Dismiss / Copy Debug / Retry button presses for the error
 * popup dialog from both Discord and Telegram using the ButtonAction interface.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createErrorPopupButtonAction = createErrorPopupButtonAction;
const cdpBridgeManager_1 = require("../services/cdpBridgeManager");
const logger_1 = require("../utils/logger");
const MAX_DEBUG_CONTENT = 4096;
function createErrorPopupButtonAction(deps) {
    return {
        match(customId) {
            const parsed = (0, cdpBridgeManager_1.parseErrorPopupCustomId)(customId);
            if (!parsed)
                return null;
            return {
                action: parsed.action,
                projectName: parsed.projectName ?? '',
                channelId: parsed.channelId ?? '',
            };
        },
        async execute(interaction, params) {
            const { action, channelId } = params;
            if (channelId && channelId !== interaction.channel.id) {
                await interaction
                    .reply({ text: 'This error popup action is linked to a different session channel.' })
                    .catch(() => { });
                return;
            }
            const projectName = params.projectName || deps.bridge.lastActiveWorkspace;
            const detector = projectName
                ? deps.bridge.pool.getErrorPopupDetector(projectName)
                : undefined;
            if (!detector) {
                await interaction
                    .reply({ text: 'Error popup detector not found.' })
                    .catch(() => { });
                return;
            }
            // Acknowledge immediately so Telegram doesn't time out
            await interaction.deferUpdate().catch(() => { });
            if (action === 'dismiss') {
                let clicked = false;
                try {
                    clicked = await detector.clickDismissButton();
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    logger_1.logger.error(`[ErrorPopupAction] CDP click failed: ${msg}`);
                    await interaction.reply({ text: `Dismiss failed: ${msg}` }).catch(() => { });
                    return;
                }
                if (clicked) {
                    await interaction
                        .update({
                        text: '🗑️ Dismissed',
                        components: [],
                    })
                        .catch((err) => {
                        logger_1.logger.warn('[ErrorPopupAction] update failed:', err);
                    });
                }
                else {
                    await interaction
                        .reply({ text: 'Dismiss button not found.' })
                        .catch(() => { });
                }
            }
            else if (action === 'copy_debug') {
                const clicked = await detector.clickCopyDebugInfoButton();
                if (!clicked) {
                    await interaction
                        .reply({ text: 'Copy debug info button not found.' })
                        .catch(() => { });
                    return;
                }
                // Wait for clipboard to be populated
                await new Promise((resolve) => setTimeout(resolve, 300));
                const clipboardContent = await detector.readClipboard();
                await interaction
                    .update({
                    text: '📋 Debug info copied',
                    components: [],
                })
                    .catch((err) => {
                    logger_1.logger.warn('[ErrorPopupAction] update failed:', err);
                });
                if (clipboardContent) {
                    const truncated = clipboardContent.length > MAX_DEBUG_CONTENT
                        ? clipboardContent.substring(0, MAX_DEBUG_CONTENT - 15) + '\n\n(truncated)'
                        : clipboardContent;
                    await interaction
                        .followUp({ text: truncated })
                        .catch((err) => {
                        logger_1.logger.warn('[ErrorPopupAction] followUp failed:', err);
                    });
                }
                else {
                    await interaction
                        .followUp({ text: 'Could not read debug info from clipboard.' })
                        .catch(() => { });
                }
            }
            else {
                // Retry action
                let clicked = false;
                try {
                    clicked = await detector.clickRetryButton();
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    logger_1.logger.error(`[ErrorPopupAction] CDP click failed: ${msg}`);
                    await interaction.reply({ text: `Retry failed: ${msg}` }).catch(() => { });
                    return;
                }
                if (clicked) {
                    await interaction
                        .update({
                        text: '🔄 Retry initiated',
                        components: [],
                    })
                        .catch((err) => {
                        logger_1.logger.warn('[ErrorPopupAction] update failed:', err);
                    });
                }
                else {
                    await interaction
                        .reply({ text: 'Retry button not found.' })
                        .catch(() => { });
                }
            }
        },
    };
}
