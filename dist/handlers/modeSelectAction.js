"use strict";
/**
 * Platform-agnostic SelectAction for mode_select interactions.
 *
 * When a user selects a mode from the inline dropdown, this action:
 *   1. Updates the ModeService
 *   2. Syncs the mode change to Antigravity via CDP
 *   3. Refreshes the mode selection UI
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createModeSelectAction = createModeSelectAction;
const cdpBridgeManager_1 = require("../services/cdpBridgeManager");
const modeService_1 = require("../services/modeService");
const modeUi_1 = require("../ui/modeUi");
const logger_1 = require("../utils/logger");
function createModeSelectAction(deps) {
    return {
        match(customId) {
            return customId === 'mode_select';
        },
        async execute(interaction, values) {
            const selectedMode = values[0];
            if (!selectedMode)
                return;
            // Validate mode name before any side effects
            const normalized = selectedMode.trim().toLowerCase();
            if (!['fast', 'plan'].includes(normalized)) {
                await interaction.followUp({ text: `Invalid mode: ${selectedMode}` }).catch(() => { });
                return;
            }
            await interaction.deferUpdate();
            // CDP-first: try to sync to Antigravity immediately
            const cdp = (0, cdpBridgeManager_1.getCurrentCdp)(deps.bridge);
            const displayName = modeService_1.MODE_DISPLAY_NAMES[selectedMode] || selectedMode;
            if (cdp) {
                const res = await cdp.setUiMode(selectedMode);
                if (!res.ok) {
                    logger_1.logger.warn(`[ModeSelect] UI mode switch failed: ${res.error}`);
                    await interaction.followUp({
                        text: `Failed to switch mode in Antigravity: ${res.error}`,
                    }).catch(() => { });
                    return;
                }
                // CDP sync succeeded — update local cache as synced
                deps.modeService.setMode(selectedMode, true);
                const payload = (0, modeUi_1.buildModePayload)(deps.modeService.getCurrentMode());
                await interaction.update(payload);
                await interaction.followUp({
                    text: `Mode changed to ${displayName}.`,
                }).catch(() => { });
            }
            else {
                // No CDP — set locally as pending
                deps.modeService.setMode(selectedMode, false);
                const payload = (0, modeUi_1.buildModePayload)(deps.modeService.getCurrentMode(), true);
                await interaction.update(payload);
                await interaction.followUp({
                    text: `Mode set to ${displayName}. Will sync when connected to Antigravity.`,
                }).catch(() => { });
            }
        },
    };
}
