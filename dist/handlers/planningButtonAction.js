"use strict";
/**
 * Platform-agnostic planning button action.
 *
 * Handles Open / Proceed button presses for the planning mode dialog
 * from both Discord and Telegram using the ButtonAction interface.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlanningButtonAction = createPlanningButtonAction;
const cdpBridgeManager_1 = require("../services/cdpBridgeManager");
const logger_1 = require("../utils/logger");
const MAX_PLAN_CONTENT = 4096;
function createPlanningButtonAction(deps) {
    return {
        match(customId) {
            const parsed = (0, cdpBridgeManager_1.parsePlanningCustomId)(customId);
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
                    .reply({ text: 'This planning action is linked to a different session channel.' })
                    .catch(() => { });
                return;
            }
            const projectName = params.projectName || deps.bridge.lastActiveWorkspace;
            const detector = projectName
                ? deps.bridge.pool.getPlanningDetector(projectName)
                : undefined;
            if (!detector) {
                await interaction
                    .reply({ text: 'Planning detector not found.' })
                    .catch(() => { });
                return;
            }
            if (action === 'open') {
                const clicked = await detector.clickOpenButton();
                if (!clicked) {
                    await interaction
                        .reply({ text: 'Open button not found.' })
                        .catch(() => { });
                    return;
                }
                // Wait for DOM to update after Open click
                await new Promise((resolve) => setTimeout(resolve, 500));
                // Extract plan content with retry
                let planContent = null;
                for (let attempt = 0; attempt < 3; attempt++) {
                    planContent = await detector.extractPlanContent();
                    if (planContent)
                        break;
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }
                await interaction
                    .update({
                    text: '📋 Plan opened',
                    components: [],
                })
                    .catch((err) => {
                    logger_1.logger.warn('[PlanningAction] update failed:', err);
                });
                if (planContent) {
                    const truncated = planContent.length > MAX_PLAN_CONTENT
                        ? planContent.substring(0, MAX_PLAN_CONTENT - 15) + '\n\n(truncated)'
                        : planContent;
                    await interaction
                        .followUp({ text: truncated })
                        .catch((err) => {
                        logger_1.logger.warn('[PlanningAction] followUp failed:', err);
                    });
                }
                else {
                    await interaction
                        .followUp({ text: 'Could not extract plan content from the editor.' })
                        .catch(() => { });
                }
            }
            else {
                // Proceed action
                await interaction.deferUpdate().catch(() => { });
                let clicked = false;
                try {
                    clicked = await detector.clickProceedButton();
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    logger_1.logger.error(`[PlanningAction] CDP click failed: ${msg}`);
                    await interaction.reply({ text: `Proceed failed: ${msg}` }).catch(() => { });
                    return;
                }
                if (clicked) {
                    await interaction
                        .update({
                        text: '▶️ Proceed started',
                        components: [],
                    })
                        .catch((err) => {
                        logger_1.logger.warn('[PlanningAction] update failed:', err);
                    });
                }
                else {
                    await interaction
                        .reply({ text: 'Proceed button not found.' })
                        .catch(() => { });
                }
            }
        },
    };
}
