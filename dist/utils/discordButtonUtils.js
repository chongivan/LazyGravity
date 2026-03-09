"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disableAllButtons = disableAllButtons;
const discord_js_1 = require("discord.js");
/**
 * Disable all buttons in message component rows.
 * Shared utility used by interaction handlers and detector callbacks.
 */
function disableAllButtons(components) {
    return components
        .map((row) => {
        const rowAny = row;
        if (!Array.isArray(rowAny.components))
            return null;
        const nextRow = new discord_js_1.ActionRowBuilder();
        const disabledButtons = rowAny.components
            .map((component) => {
            const componentType = component?.type ?? component?.data?.type;
            if (componentType !== 2)
                return null;
            const payload = typeof component?.toJSON === 'function'
                ? component.toJSON()
                : component;
            return discord_js_1.ButtonBuilder.from(payload).setDisabled(true);
        })
            .filter((button) => button !== null);
        if (disabledButtons.length === 0)
            return null;
        nextRow.addComponents(...disabledButtons);
        return nextRow;
    })
        .filter((row) => row !== null);
}
