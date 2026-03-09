"use strict";
/**
 * Platform-agnostic ButtonAction for template execution interactions.
 *
 * When a template button is clicked, the template prompt is injected into
 * Antigravity via CDP. The user receives a confirmation message.
 *
 * Handles: template_btn_<id>
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTemplateButtonAction = createTemplateButtonAction;
const cdpBridgeManager_1 = require("../services/cdpBridgeManager");
const templateUi_1 = require("../ui/templateUi");
const logger_1 = require("../utils/logger");
function createTemplateButtonAction(deps) {
    return {
        match(customId) {
            if (!customId.startsWith(templateUi_1.TEMPLATE_BTN_PREFIX))
                return null;
            const id = (0, templateUi_1.parseTemplateButtonId)(customId);
            if (isNaN(id))
                return null;
            return { templateId: String(id) };
        },
        async execute(interaction, params) {
            const templateId = parseInt(params.templateId, 10);
            const template = deps.templateRepo.findById(templateId);
            if (!template) {
                await interaction.reply({ text: 'Template not found. It may have been deleted.' }).catch(() => { });
                return;
            }
            await interaction.deferUpdate();
            const cdp = (0, cdpBridgeManager_1.getCurrentCdp)(deps.bridge);
            if (!cdp) {
                await interaction.followUp({
                    text: 'Not connected to Antigravity. Send the prompt as a message instead.',
                }).catch(() => { });
                return;
            }
            // Inject the template prompt
            logger_1.logger.info(`[TemplateButton] Executing template "${template.name}" (id=${template.id})`);
            const result = await cdp.injectMessage(template.prompt);
            if (!result.ok) {
                await interaction.followUp({
                    text: `Failed to execute template: ${result.error}`,
                }).catch(() => { });
                return;
            }
            await interaction.followUp({
                text: `Executing template: ${template.name}`,
            }).catch(() => { });
        },
    };
}
