"use strict";
/**
 * Platform-agnostic approval button action.
 *
 * Handles Allow / Always Allow / Deny button presses from both Discord
 * and Telegram using the ButtonAction interface.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApprovalButtonAction = createApprovalButtonAction;
const cdpBridgeManager_1 = require("../services/cdpBridgeManager");
const logger_1 = require("../utils/logger");
function createApprovalButtonAction(deps) {
    return {
        match(customId) {
            const parsed = (0, cdpBridgeManager_1.parseApprovalCustomId)(customId);
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
            // Acknowledge immediately so Telegram doesn't time out
            await interaction.deferUpdate().catch(() => { });
            // Channel scope check (skip if no channelId was encoded)
            if (channelId && channelId !== interaction.channel.id) {
                await interaction
                    .reply({ text: 'This approval action is linked to a different session channel.' })
                    .catch(() => { });
                return;
            }
            const projectName = params.projectName || deps.bridge.lastActiveWorkspace;
            logger_1.logger.debug(`[ApprovalAction] action=${action} project=${projectName ?? 'null'} channel=${interaction.channel.id}`);
            const detector = projectName
                ? deps.bridge.pool.getApprovalDetector(projectName)
                : undefined;
            if (!detector) {
                logger_1.logger.warn(`[ApprovalAction] No detector for project=${projectName}`);
                await interaction
                    .reply({ text: 'Approval detector not found.' })
                    .catch(() => { });
                return;
            }
            const lastInfo = detector.getLastDetectedInfo();
            logger_1.logger.debug(`[ApprovalAction] lastDetectedInfo: ${lastInfo ? JSON.stringify(lastInfo) : 'null'}`);
            let success = false;
            let actionLabel = '';
            try {
                if (action === 'approve') {
                    success = await detector.approveButton();
                    actionLabel = 'Allow';
                }
                else if (action === 'always_allow') {
                    success = await detector.alwaysAllowButton();
                    actionLabel = 'Allow Chat';
                }
                else {
                    success = await detector.denyButton();
                    actionLabel = 'Deny';
                }
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger_1.logger.error(`[ApprovalAction] CDP click failed: ${msg}`);
                await interaction
                    .reply({ text: `Approval failed: ${msg}` })
                    .catch(() => { });
                return;
            }
            logger_1.logger.debug(`[ApprovalAction] ${actionLabel} result: ${success}`);
            if (success) {
                // Remove buttons by editing the original message.
                // If update() fails, fall back to editReply(), then followUp().
                const updatePayload = { text: `✅ ${actionLabel} completed`, components: [] };
                try {
                    await interaction.update(updatePayload);
                }
                catch (updateErr) {
                    logger_1.logger.warn('[ApprovalAction] update failed, trying editReply:', updateErr);
                    try {
                        await interaction.editReply(updatePayload);
                    }
                    catch (editErr) {
                        logger_1.logger.warn('[ApprovalAction] editReply failed, sending followUp:', editErr);
                        await interaction.followUp({ text: `✅ ${actionLabel} completed` }).catch(() => { });
                    }
                }
            }
            else {
                await interaction
                    .reply({ text: 'Approval button not found.' })
                    .catch(() => { });
            }
        },
    };
}
