"use strict";
/**
 * Platform-agnostic slash command handler.
 *
 * Maintains a lookup map from command name to CommandDef for O(1) dispatch.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlatformCommandHandler = createPlatformCommandHandler;
const logger_1 = require("../utils/logger");
// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
/**
 * Create a platform-agnostic slash command handler.
 * Returns an async function that processes PlatformCommandInteraction events.
 */
function createPlatformCommandHandler(deps) {
    const commandMap = new Map();
    for (const cmd of deps.commands) {
        commandMap.set(cmd.name, cmd);
    }
    return async (interaction) => {
        const cmd = commandMap.get(interaction.commandName);
        if (!cmd) {
            logger_1.logger.warn(`[CommandHandler] Unknown command: ${interaction.commandName}`);
            await interaction.editReply({
                text: `Unknown command: ${interaction.commandName}`,
            }).catch(() => { });
            return;
        }
        try {
            await cmd.execute(interaction);
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger_1.logger.error(`[CommandHandler] Command "${interaction.commandName}" error:`, errorMessage);
            await interaction
                .editReply({
                text: 'An error occurred while processing the command.',
            })
                .catch(() => { });
        }
    };
}
