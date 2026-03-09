"use strict";
/**
 * Platform-agnostic button interaction handler.
 *
 * Uses a registry pattern: each button type registers a match+execute pair.
 * The first matching action wins (order matters).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlatformButtonHandler = createPlatformButtonHandler;
const logger_1 = require("../utils/logger");
// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
/**
 * Create a platform-agnostic button interaction handler.
 * Returns an async function that processes PlatformButtonInteraction events.
 */
function createPlatformButtonHandler(deps) {
    return async (interaction) => {
        for (const action of deps.actions) {
            let params;
            try {
                params = action.match(interaction.customId);
            }
            catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                logger_1.logger.error('[ButtonHandler] Match error:', errorMessage);
                await interaction
                    .reply({
                    text: 'An error occurred while processing the button action.',
                    ephemeral: true,
                })
                    .catch(() => { });
                return;
            }
            if (params !== null) {
                try {
                    await action.execute(interaction, params);
                }
                catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    logger_1.logger.error('[ButtonHandler] Action error:', errorMessage);
                    await interaction
                        .reply({
                        text: 'An error occurred while processing the button action.',
                        ephemeral: true,
                    })
                        .catch(() => { });
                }
                return;
            }
        }
        logger_1.logger.warn(`[ButtonHandler] No handler for customId: ${interaction.customId}`);
    };
}
