"use strict";
/**
 * Platform-agnostic run command button action.
 *
 * Handles Run / Reject button presses for the "Run command?"
 * dialog from both Discord and Telegram using the ButtonAction interface.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRunCommandButtonAction = createRunCommandButtonAction;
const cdpBridgeManager_1 = require("../services/cdpBridgeManager");
const logger_1 = require("../utils/logger");
function createRunCommandButtonAction(deps) {
    return {
        match(customId) {
            const parsed = (0, cdpBridgeManager_1.parseRunCommandCustomId)(customId);
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
            if (channelId && channelId !== interaction.channel.id) {
                await interaction
                    .reply({ text: 'This run command action is linked to a different session channel.' })
                    .catch(() => { });
                return;
            }
            const projectName = params.projectName || deps.bridge.lastActiveWorkspace;
            const detector = projectName
                ? deps.bridge.pool.getRunCommandDetector(projectName)
                : undefined;
            if (!detector) {
                logger_1.logger.warn(`[RunCommandAction] No detector for project=${projectName}`);
                await interaction
                    .reply({ text: 'Run command detector not found.' })
                    .catch(() => { });
                return;
            }
            let success = false;
            let actionLabel = '';
            try {
                if (action === 'run') {
                    success = await detector.runButton();
                    actionLabel = 'Run';
                }
                else {
                    success = await detector.rejectButton();
                    actionLabel = 'Reject';
                }
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger_1.logger.error(`[RunCommandAction] CDP click failed: ${msg}`);
                await interaction
                    .reply({ text: `Run command action failed: ${msg}` })
                    .catch(() => { });
                return;
            }
            if (success) {
                await interaction
                    .update({ text: `${action === 'run' ? '▶️' : '⛔'} ${actionLabel} completed`, components: [] })
                    .catch((err) => {
                    logger_1.logger.warn('[RunCommandAction] update failed, trying editReply:', err);
                    interaction.editReply({ text: `${action === 'run' ? '▶️' : '⛔'} ${actionLabel} completed`, components: [] })
                        .catch((editErr) => {
                        logger_1.logger.warn('[RunCommandAction] editReply failed, sending followUp:', editErr);
                        interaction.followUp({ text: `${action === 'run' ? '▶️' : '⛔'} ${actionLabel} completed` }).catch(() => { });
                    });
                });
            }
            else {
                await interaction
                    .reply({ text: 'Run command button not found.' })
                    .catch(() => { });
            }
        },
    };
}
