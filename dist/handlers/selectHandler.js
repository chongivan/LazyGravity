"use strict";
/**
 * Platform-agnostic select menu interaction handler.
 *
 * Uses a registry pattern similar to buttonHandler: each select type
 * registers a match+execute pair.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlatformSelectHandler = createPlatformSelectHandler;
const logger_1 = require("../utils/logger");
// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
/**
 * Create a platform-agnostic select menu handler.
 * Returns an async function that processes PlatformSelectInteraction events.
 */
function createPlatformSelectHandler(deps) {
    return async (interaction) => {
        for (const action of deps.actions) {
            try {
                if (!action.match(interaction.customId))
                    continue;
                await action.execute(interaction, interaction.values);
                return;
            }
            catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                logger_1.logger.error('[SelectHandler] Action error:', errorMessage);
                await interaction
                    .reply({
                    text: 'An error occurred while processing the selection.',
                    ephemeral: true,
                })
                    .catch(() => { });
                return;
            }
        }
        logger_1.logger.warn(`[SelectHandler] No handler for customId: ${interaction.customId}`);
    };
}
