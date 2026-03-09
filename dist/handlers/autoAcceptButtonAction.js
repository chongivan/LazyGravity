"use strict";
/**
 * Platform-agnostic ButtonAction for auto-accept toggle interactions.
 *
 * Handles:
 *   autoaccept_btn_on      — Enable auto-accept
 *   autoaccept_btn_off     — Disable auto-accept
 *   autoaccept_btn_refresh — Refresh the auto-accept UI
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAutoAcceptButtonAction = createAutoAcceptButtonAction;
const autoAcceptUi_1 = require("../ui/autoAcceptUi");
function createAutoAcceptButtonAction(deps) {
    return {
        match(customId) {
            if (customId === autoAcceptUi_1.AUTOACCEPT_BTN_ON)
                return { action: 'on' };
            if (customId === autoAcceptUi_1.AUTOACCEPT_BTN_OFF)
                return { action: 'off' };
            if (customId === autoAcceptUi_1.AUTOACCEPT_BTN_REFRESH)
                return { action: 'refresh' };
            return null;
        },
        async execute(interaction, params) {
            await interaction.deferUpdate();
            if (params.action === 'on' || params.action === 'off') {
                const result = deps.autoAcceptService.handle(params.action);
                // Only update UI if the state actually changed to avoid
                // Telegram "message is not modified" error.
                if (result.changed) {
                    const payload = (0, autoAcceptUi_1.buildAutoAcceptPayload)(deps.autoAcceptService.isEnabled());
                    await interaction.update(payload);
                }
                await interaction.followUp({ text: result.message }).catch(() => { });
            }
            else {
                // refresh — always update to show latest state
                const payload = (0, autoAcceptUi_1.buildAutoAcceptPayload)(deps.autoAcceptService.isEnabled());
                await interaction.update(payload);
            }
        },
    };
}
