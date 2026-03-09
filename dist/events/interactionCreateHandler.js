"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInteractionCreateHandler = createInteractionCreateHandler;
const discord_js_1 = require("discord.js");
const i18n_1 = require("../utils/i18n");
const logger_1 = require("../utils/logger");
const discordButtonUtils_1 = require("../utils/discordButtonUtils");
const templateUi_1 = require("../ui/templateUi");
const autoAcceptUi_1 = require("../ui/autoAcceptUi");
const outputUi_1 = require("../ui/outputUi");
const cleanupCommandHandler_1 = require("../commands/cleanupCommandHandler");
const projectListUi_1 = require("../ui/projectListUi");
const modeService_1 = require("../services/modeService");
const sessionPickerUi_1 = require("../ui/sessionPickerUi");
function createInteractionCreateHandler(deps) {
    return async (interaction) => {
        if (interaction.isButton()) {
            if (!deps.config.allowedUserIds.includes(interaction.user.id)) {
                await interaction.reply({ content: (0, i18n_1.t)('You do not have permission.'), flags: discord_js_1.MessageFlags.Ephemeral }).catch(logger_1.logger.error);
                return;
            }
            try {
                const approvalAction = deps.parseApprovalCustomId(interaction.customId);
                if (approvalAction) {
                    if (approvalAction.channelId && approvalAction.channelId !== interaction.channelId) {
                        await interaction.reply({
                            content: (0, i18n_1.t)('This approval action is linked to a different session channel.'),
                            flags: discord_js_1.MessageFlags.Ephemeral,
                        }).catch(logger_1.logger.error);
                        return;
                    }
                    const projectName = approvalAction.projectName ?? deps.bridge.lastActiveWorkspace;
                    const detector = projectName
                        ? deps.bridge.pool.getApprovalDetector(projectName)
                        : undefined;
                    if (!detector) {
                        try {
                            await interaction.reply({ content: (0, i18n_1.t)('Approval detector not found.'), flags: discord_js_1.MessageFlags.Ephemeral });
                        }
                        catch { /* ignore */ }
                        return;
                    }
                    let success = false;
                    let actionLabel = '';
                    if (approvalAction.action === 'approve') {
                        success = await detector.approveButton();
                        actionLabel = (0, i18n_1.t)('Allow');
                    }
                    else if (approvalAction.action === 'always_allow') {
                        success = await detector.alwaysAllowButton();
                        actionLabel = (0, i18n_1.t)('Allow Chat');
                    }
                    else {
                        success = await detector.denyButton();
                        actionLabel = (0, i18n_1.t)('Deny');
                    }
                    try {
                        if (success) {
                            const originalEmbed = interaction.message.embeds[0];
                            const updatedEmbed = originalEmbed
                                ? discord_js_1.EmbedBuilder.from(originalEmbed)
                                : new discord_js_1.EmbedBuilder().setTitle('Approval Request');
                            const historyText = `${actionLabel} by <@${interaction.user.id}> (${new Date().toLocaleString('ja-JP')})`;
                            updatedEmbed
                                .setColor(approvalAction.action === 'deny' ? 0xE74C3C : 0x2ECC71)
                                .addFields({ name: 'Action History', value: historyText, inline: false })
                                .setTimestamp();
                            await interaction.update({
                                embeds: [updatedEmbed],
                                components: (0, discordButtonUtils_1.disableAllButtons)(interaction.message.components),
                            });
                        }
                        else {
                            await interaction.reply({ content: 'Approval button not found.', flags: discord_js_1.MessageFlags.Ephemeral });
                        }
                    }
                    catch (interactionError) {
                        if (interactionError?.code === 10062 || interactionError?.code === 40060) {
                            logger_1.logger.warn('[Approval] Interaction expired. Responding directly in the channel.');
                            if (interaction.channel && 'send' in interaction.channel) {
                                const fallbackMessage = success
                                    ? `${actionLabel} completed.`
                                    : 'Approval button not found.';
                                await interaction.channel.send(fallbackMessage).catch(logger_1.logger.error);
                            }
                        }
                        else {
                            throw interactionError;
                        }
                    }
                    return;
                }
                const planningAction = deps.parsePlanningCustomId(interaction.customId);
                if (planningAction) {
                    if (planningAction.channelId && planningAction.channelId !== interaction.channelId) {
                        await interaction.reply({
                            content: (0, i18n_1.t)('This planning action is linked to a different session channel.'),
                            flags: discord_js_1.MessageFlags.Ephemeral,
                        }).catch(logger_1.logger.error);
                        return;
                    }
                    const planWorkspaceDirName = planningAction.projectName ?? deps.bridge.lastActiveWorkspace;
                    const planDetector = planWorkspaceDirName
                        ? deps.bridge.pool.getPlanningDetector(planWorkspaceDirName)
                        : undefined;
                    if (!planDetector) {
                        try {
                            await interaction.reply({ content: (0, i18n_1.t)('Planning detector not found.'), flags: discord_js_1.MessageFlags.Ephemeral });
                        }
                        catch { /* ignore */ }
                        return;
                    }
                    try {
                        if (planningAction.action === 'open') {
                            await interaction.deferUpdate();
                            const clicked = await planDetector.clickOpenButton();
                            if (!clicked) {
                                await interaction.followUp({ content: (0, i18n_1.t)('Open button not found.'), flags: discord_js_1.MessageFlags.Ephemeral });
                                return;
                            }
                            // Wait for DOM to update after Open click
                            await new Promise((resolve) => setTimeout(resolve, 500));
                            // Extract plan content with retry
                            let planContent = null;
                            for (let attempt = 0; attempt < 3; attempt++) {
                                planContent = await planDetector.extractPlanContent();
                                if (planContent)
                                    break;
                                await new Promise((resolve) => setTimeout(resolve, 500));
                            }
                            // Update original embed with action history
                            const originalEmbed = interaction.message.embeds[0];
                            const updatedEmbed = originalEmbed
                                ? discord_js_1.EmbedBuilder.from(originalEmbed)
                                : new discord_js_1.EmbedBuilder().setTitle('Planning Mode');
                            const historyText = `Open by <@${interaction.user.id}> (${new Date().toLocaleString('ja-JP')})`;
                            updatedEmbed
                                .setColor(0x3498DB)
                                .addFields({ name: 'Action History', value: historyText, inline: false })
                                .setTimestamp();
                            await interaction.editReply({
                                embeds: [updatedEmbed],
                                components: interaction.message.components,
                            });
                            // Send plan content as a new message in the same channel
                            if (planContent && interaction.channel && 'send' in interaction.channel) {
                                // Discord embed description limit is 4096 chars
                                const MAX_PLAN_CONTENT = 4096;
                                const truncated = planContent.length > MAX_PLAN_CONTENT
                                    ? planContent.substring(0, MAX_PLAN_CONTENT - 15) + '\n\n(truncated)'
                                    : planContent;
                                const planEmbed = new discord_js_1.EmbedBuilder()
                                    .setTitle((0, i18n_1.t)('Plan Content'))
                                    .setDescription(truncated)
                                    .setColor(0x3498DB)
                                    .setTimestamp();
                                await interaction.channel.send({ embeds: [planEmbed] }).catch(logger_1.logger.error);
                            }
                            else if (!planContent) {
                                await interaction.followUp({
                                    content: (0, i18n_1.t)('Could not extract plan content from the editor.'),
                                    flags: discord_js_1.MessageFlags.Ephemeral,
                                }).catch(logger_1.logger.error);
                            }
                        }
                        else {
                            // Proceed action
                            const clicked = await planDetector.clickProceedButton();
                            const originalEmbed = interaction.message.embeds[0];
                            const updatedEmbed = originalEmbed
                                ? discord_js_1.EmbedBuilder.from(originalEmbed)
                                : new discord_js_1.EmbedBuilder().setTitle('Planning Mode');
                            const historyText = `Proceed by <@${interaction.user.id}> (${new Date().toLocaleString('ja-JP')})`;
                            updatedEmbed
                                .setColor(clicked ? 0x2ECC71 : 0xE74C3C)
                                .addFields({ name: 'Action History', value: historyText, inline: false })
                                .setTimestamp();
                            try {
                                await interaction.update({
                                    embeds: [updatedEmbed],
                                    components: (0, discordButtonUtils_1.disableAllButtons)(interaction.message.components),
                                });
                            }
                            catch (interactionError) {
                                if (interactionError?.code === 10062 || interactionError?.code === 40060) {
                                    logger_1.logger.warn('[Planning] Interaction expired. Responding directly in the channel.');
                                    if (interaction.channel && 'send' in interaction.channel) {
                                        const fallbackMessage = clicked
                                            ? (0, i18n_1.t)('Proceed completed. Implementation started.')
                                            : (0, i18n_1.t)('Proceed button not found.');
                                        await interaction.channel.send(fallbackMessage).catch(logger_1.logger.error);
                                    }
                                }
                                else {
                                    throw interactionError;
                                }
                            }
                        }
                    }
                    catch (planError) {
                        if (planError?.code === 10062 || planError?.code === 40060) {
                            logger_1.logger.warn('[Planning] Interaction expired.');
                        }
                        else {
                            logger_1.logger.error('[Planning] Error handling planning button:', planError);
                            try {
                                if (!interaction.replied && !interaction.deferred) {
                                    await interaction.reply({ content: (0, i18n_1.t)('An error occurred while processing the planning action.'), flags: discord_js_1.MessageFlags.Ephemeral });
                                }
                                else {
                                    await interaction.followUp({ content: (0, i18n_1.t)('An error occurred while processing the planning action.'), flags: discord_js_1.MessageFlags.Ephemeral }).catch(logger_1.logger.error);
                                }
                            }
                            catch { /* ignore */ }
                        }
                    }
                    return;
                }
                const errorPopupAction = deps.parseErrorPopupCustomId(interaction.customId);
                if (errorPopupAction) {
                    if (errorPopupAction.channelId && errorPopupAction.channelId !== interaction.channelId) {
                        await interaction.reply({
                            content: (0, i18n_1.t)('This error popup action is linked to a different session channel.'),
                            flags: discord_js_1.MessageFlags.Ephemeral,
                        }).catch(logger_1.logger.error);
                        return;
                    }
                    const errorWorkspaceDirName = errorPopupAction.projectName ?? deps.bridge.lastActiveWorkspace;
                    const errorDetector = errorWorkspaceDirName
                        ? deps.bridge.pool.getErrorPopupDetector(errorWorkspaceDirName)
                        : undefined;
                    if (!errorDetector) {
                        try {
                            await interaction.reply({ content: (0, i18n_1.t)('Error popup detector not found.'), flags: discord_js_1.MessageFlags.Ephemeral });
                        }
                        catch { /* ignore */ }
                        return;
                    }
                    try {
                        if (errorPopupAction.action === 'dismiss') {
                            const clicked = await errorDetector.clickDismissButton();
                            const originalEmbed = interaction.message.embeds[0];
                            const updatedEmbed = originalEmbed
                                ? discord_js_1.EmbedBuilder.from(originalEmbed)
                                : new discord_js_1.EmbedBuilder().setTitle('Agent Error');
                            const historyText = `Dismiss by <@${interaction.user.id}> (${new Date().toLocaleString('ja-JP')})`;
                            updatedEmbed
                                .setColor(clicked ? 0x95A5A6 : 0xE74C3C)
                                .addFields({ name: 'Action History', value: historyText, inline: false })
                                .setTimestamp();
                            try {
                                await interaction.update({
                                    embeds: [updatedEmbed],
                                    components: (0, discordButtonUtils_1.disableAllButtons)(interaction.message.components),
                                });
                            }
                            catch (interactionError) {
                                if (interactionError?.code === 10062 || interactionError?.code === 40060) {
                                    logger_1.logger.warn('[ErrorPopup] Interaction expired. Responding directly in the channel.');
                                    if (interaction.channel && 'send' in interaction.channel) {
                                        const fallbackMessage = clicked
                                            ? (0, i18n_1.t)('Error popup dismissed.')
                                            : (0, i18n_1.t)('Dismiss button not found.');
                                        await interaction.channel.send(fallbackMessage).catch(logger_1.logger.error);
                                    }
                                }
                                else {
                                    throw interactionError;
                                }
                            }
                        }
                        else if (errorPopupAction.action === 'copy_debug') {
                            await interaction.deferUpdate();
                            const clicked = await errorDetector.clickCopyDebugInfoButton();
                            if (!clicked) {
                                await interaction.followUp({ content: (0, i18n_1.t)('Copy debug info button not found.'), flags: discord_js_1.MessageFlags.Ephemeral });
                                return;
                            }
                            // Wait for clipboard to be populated
                            await new Promise((resolve) => setTimeout(resolve, 300));
                            const clipboardContent = await errorDetector.readClipboard();
                            // Update original embed with action history
                            const originalEmbed = interaction.message.embeds[0];
                            const updatedEmbed = originalEmbed
                                ? discord_js_1.EmbedBuilder.from(originalEmbed)
                                : new discord_js_1.EmbedBuilder().setTitle('Agent Error');
                            const historyText = `Copy debug info by <@${interaction.user.id}> (${new Date().toLocaleString('ja-JP')})`;
                            updatedEmbed
                                .setColor(0x3498DB)
                                .addFields({ name: 'Action History', value: historyText, inline: false })
                                .setTimestamp();
                            await interaction.editReply({
                                embeds: [updatedEmbed],
                                components: interaction.message.components,
                            });
                            // Send debug info as a new message
                            if (clipboardContent && interaction.channel && 'send' in interaction.channel) {
                                const MAX_DEBUG_CONTENT = 4096;
                                const truncated = clipboardContent.length > MAX_DEBUG_CONTENT
                                    ? clipboardContent.substring(0, MAX_DEBUG_CONTENT - 15) + '\n\n(truncated)'
                                    : clipboardContent;
                                const debugEmbed = new discord_js_1.EmbedBuilder()
                                    .setTitle((0, i18n_1.t)('Debug Info'))
                                    .setDescription(`\`\`\`\n${truncated}\n\`\`\``)
                                    .setColor(0x3498DB)
                                    .setTimestamp();
                                await interaction.channel.send({ embeds: [debugEmbed] }).catch(logger_1.logger.error);
                            }
                            else if (!clipboardContent) {
                                await interaction.followUp({
                                    content: (0, i18n_1.t)('Could not read debug info from clipboard.'),
                                    flags: discord_js_1.MessageFlags.Ephemeral,
                                }).catch(logger_1.logger.error);
                            }
                        }
                        else {
                            // Retry action
                            const clicked = await errorDetector.clickRetryButton();
                            const originalEmbed = interaction.message.embeds[0];
                            const updatedEmbed = originalEmbed
                                ? discord_js_1.EmbedBuilder.from(originalEmbed)
                                : new discord_js_1.EmbedBuilder().setTitle('Agent Error');
                            const historyText = `Retry by <@${interaction.user.id}> (${new Date().toLocaleString('ja-JP')})`;
                            updatedEmbed
                                .setColor(clicked ? 0x2ECC71 : 0xE74C3C)
                                .addFields({ name: 'Action History', value: historyText, inline: false })
                                .setTimestamp();
                            try {
                                await interaction.update({
                                    embeds: [updatedEmbed],
                                    components: (0, discordButtonUtils_1.disableAllButtons)(interaction.message.components),
                                });
                            }
                            catch (interactionError) {
                                if (interactionError?.code === 10062 || interactionError?.code === 40060) {
                                    logger_1.logger.warn('[ErrorPopup] Interaction expired. Responding directly in the channel.');
                                    if (interaction.channel && 'send' in interaction.channel) {
                                        const fallbackMessage = clicked
                                            ? (0, i18n_1.t)('Retry initiated.')
                                            : (0, i18n_1.t)('Retry button not found.');
                                        await interaction.channel.send(fallbackMessage).catch(logger_1.logger.error);
                                    }
                                }
                                else {
                                    throw interactionError;
                                }
                            }
                        }
                    }
                    catch (errorPopupError) {
                        if (errorPopupError?.code === 10062 || errorPopupError?.code === 40060) {
                            logger_1.logger.warn('[ErrorPopup] Interaction expired.');
                        }
                        else {
                            logger_1.logger.error('[ErrorPopup] Error handling error popup button:', errorPopupError);
                            try {
                                if (!interaction.replied && !interaction.deferred) {
                                    await interaction.reply({ content: (0, i18n_1.t)('An error occurred while processing the error popup action.'), flags: discord_js_1.MessageFlags.Ephemeral });
                                }
                                else {
                                    await interaction.followUp({ content: (0, i18n_1.t)('An error occurred while processing the error popup action.'), flags: discord_js_1.MessageFlags.Ephemeral }).catch(logger_1.logger.error);
                                }
                            }
                            catch { /* ignore */ }
                        }
                    }
                    return;
                }
                const runCommandAction = deps.parseRunCommandCustomId(interaction.customId);
                if (runCommandAction) {
                    if (runCommandAction.channelId && runCommandAction.channelId !== interaction.channelId) {
                        await interaction.reply({
                            content: (0, i18n_1.t)('This run command action is linked to a different session channel.'),
                            flags: discord_js_1.MessageFlags.Ephemeral,
                        }).catch(logger_1.logger.error);
                        return;
                    }
                    const runCmdWorkspace = runCommandAction.projectName ?? deps.bridge.lastActiveWorkspace;
                    const runCmdDetector = runCmdWorkspace
                        ? deps.bridge.pool.getRunCommandDetector(runCmdWorkspace)
                        : undefined;
                    if (!runCmdDetector) {
                        try {
                            await interaction.reply({ content: (0, i18n_1.t)('Run command detector not found.'), flags: discord_js_1.MessageFlags.Ephemeral });
                        }
                        catch { /* ignore */ }
                        return;
                    }
                    let success = false;
                    let actionLabel = '';
                    if (runCommandAction.action === 'run') {
                        success = await runCmdDetector.runButton();
                        actionLabel = (0, i18n_1.t)('Run');
                    }
                    else {
                        success = await runCmdDetector.rejectButton();
                        actionLabel = (0, i18n_1.t)('Reject');
                    }
                    try {
                        if (success) {
                            const originalEmbed = interaction.message.embeds[0];
                            const updatedEmbed = originalEmbed
                                ? discord_js_1.EmbedBuilder.from(originalEmbed)
                                : new discord_js_1.EmbedBuilder().setTitle('Run Command');
                            const historyText = `${actionLabel} by <@${interaction.user.id}> (${new Date().toLocaleString('ja-JP')})`;
                            updatedEmbed
                                .setColor(runCommandAction.action === 'reject' ? 0xE74C3C : 0x2ECC71)
                                .addFields({ name: 'Action History', value: historyText, inline: false })
                                .setTimestamp();
                            await interaction.update({
                                embeds: [updatedEmbed],
                                components: (0, discordButtonUtils_1.disableAllButtons)(interaction.message.components),
                            });
                        }
                        else {
                            await interaction.reply({ content: (0, i18n_1.t)('Run command button not found.'), flags: discord_js_1.MessageFlags.Ephemeral });
                        }
                    }
                    catch (interactionError) {
                        if (interactionError?.code === 10062 || interactionError?.code === 40060) {
                            logger_1.logger.warn('[RunCommand] Interaction expired. Responding directly in the channel.');
                            if (interaction.channel && 'send' in interaction.channel) {
                                const fallbackMessage = success
                                    ? `${actionLabel} completed.`
                                    : (0, i18n_1.t)('Run command button not found.');
                                await interaction.channel.send(fallbackMessage).catch(logger_1.logger.error);
                            }
                        }
                        else {
                            throw interactionError;
                        }
                    }
                    return;
                }
                if (interaction.customId === cleanupCommandHandler_1.CLEANUP_ARCHIVE_BTN) {
                    await deps.cleanupHandler.handleArchive(interaction);
                    return;
                }
                if (interaction.customId === cleanupCommandHandler_1.CLEANUP_DELETE_BTN) {
                    await deps.cleanupHandler.handleDelete(interaction);
                    return;
                }
                if (interaction.customId === cleanupCommandHandler_1.CLEANUP_CANCEL_BTN) {
                    await deps.cleanupHandler.handleCancel(interaction);
                    return;
                }
                if (interaction.customId === 'model_set_default_btn') {
                    await interaction.deferUpdate();
                    const cdp = deps.getCurrentCdp(deps.bridge);
                    if (!cdp) {
                        await interaction.followUp({ content: 'Not connected to CDP.', flags: discord_js_1.MessageFlags.Ephemeral });
                        return;
                    }
                    const currentModel = await cdp.getCurrentModel();
                    if (!currentModel) {
                        await interaction.followUp({ content: 'No current model detected.', flags: discord_js_1.MessageFlags.Ephemeral });
                        return;
                    }
                    deps.modelService.setDefaultModel(currentModel);
                    if (deps.userPrefRepo) {
                        deps.userPrefRepo.setDefaultModel(interaction.user.id, currentModel);
                    }
                    await deps.sendModelsUI({ editReply: async (data) => await interaction.editReply(data) }, {
                        getCurrentCdp: () => deps.getCurrentCdp(deps.bridge),
                        fetchQuota: async () => deps.bridge.quota.fetchQuota(),
                    });
                    await interaction.followUp({ content: `Default model set to **${currentModel}**.`, flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                if (interaction.customId === 'model_clear_default_btn') {
                    await interaction.deferUpdate();
                    deps.modelService.setDefaultModel(null);
                    if (deps.userPrefRepo) {
                        deps.userPrefRepo.setDefaultModel(interaction.user.id, null);
                    }
                    await deps.sendModelsUI({ editReply: async (data) => await interaction.editReply(data) }, {
                        getCurrentCdp: () => deps.getCurrentCdp(deps.bridge),
                        fetchQuota: async () => deps.bridge.quota.fetchQuota(),
                    });
                    await interaction.followUp({ content: 'Default model cleared.', flags: discord_js_1.MessageFlags.Ephemeral });
                    return;
                }
                if (interaction.customId === 'model_refresh_btn') {
                    await interaction.deferUpdate();
                    await deps.sendModelsUI({ editReply: async (data) => await interaction.editReply(data) }, {
                        getCurrentCdp: () => deps.getCurrentCdp(deps.bridge),
                        fetchQuota: async () => deps.bridge.quota.fetchQuota(),
                    });
                    return;
                }
                if (interaction.customId.startsWith('model_btn_')) {
                    await interaction.deferUpdate();
                    const modelName = interaction.customId.replace('model_btn_', '');
                    const cdp = deps.getCurrentCdp(deps.bridge);
                    if (!cdp) {
                        await interaction.followUp({ content: 'Not connected to CDP.', flags: discord_js_1.MessageFlags.Ephemeral });
                        return;
                    }
                    const res = await cdp.setUiModel(modelName);
                    if (!res.ok) {
                        await interaction.followUp({ content: res.error || 'Failed to change model.', flags: discord_js_1.MessageFlags.Ephemeral });
                    }
                    else {
                        await deps.sendModelsUI({ editReply: async (data) => await interaction.editReply(data) }, {
                            getCurrentCdp: () => deps.getCurrentCdp(deps.bridge),
                            fetchQuota: async () => deps.bridge.quota.fetchQuota(),
                        });
                        await interaction.followUp({ content: `Model changed to **${res.model}**!`, flags: discord_js_1.MessageFlags.Ephemeral });
                    }
                    return;
                }
                if (interaction.customId === autoAcceptUi_1.AUTOACCEPT_BTN_REFRESH) {
                    await interaction.deferUpdate();
                    await deps.sendAutoAcceptUI({ editReply: async (data) => await interaction.editReply(data) }, deps.bridge.autoAccept);
                    return;
                }
                if (interaction.customId === autoAcceptUi_1.AUTOACCEPT_BTN_ON || interaction.customId === autoAcceptUi_1.AUTOACCEPT_BTN_OFF) {
                    await interaction.deferUpdate();
                    const action = interaction.customId === autoAcceptUi_1.AUTOACCEPT_BTN_ON ? 'on' : 'off';
                    const result = deps.bridge.autoAccept.handle(action);
                    await deps.sendAutoAcceptUI({ editReply: async (data) => await interaction.editReply(data) }, deps.bridge.autoAccept);
                    await interaction.followUp({
                        content: result.message,
                        flags: discord_js_1.MessageFlags.Ephemeral,
                    });
                    return;
                }
                if (interaction.customId === outputUi_1.OUTPUT_BTN_EMBED || interaction.customId === outputUi_1.OUTPUT_BTN_PLAIN) {
                    if (deps.userPrefRepo) {
                        await interaction.deferUpdate();
                        const format = interaction.customId === outputUi_1.OUTPUT_BTN_PLAIN ? 'plain' : 'embed';
                        deps.userPrefRepo.setOutputFormat(interaction.user.id, format);
                        await (0, outputUi_1.sendOutputUI)({ editReply: async (data) => await interaction.editReply(data) }, format);
                        const label = format === 'plain' ? 'Plain Text' : 'Embed';
                        await interaction.followUp({
                            content: `Output format changed to **${label}**.`,
                            flags: discord_js_1.MessageFlags.Ephemeral,
                        });
                    }
                    return;
                }
                if (interaction.customId.startsWith(`${projectListUi_1.PROJECT_PAGE_PREFIX}:`)) {
                    const page = (0, projectListUi_1.parseProjectPageId)(interaction.customId);
                    if (!isNaN(page) && page >= 0) {
                        await deps.wsHandler.handlePageButton(interaction, page);
                    }
                    return;
                }
                if (interaction.customId.startsWith(templateUi_1.TEMPLATE_BTN_PREFIX)) {
                    await interaction.deferUpdate();
                    const templateId = (0, templateUi_1.parseTemplateButtonId)(interaction.customId);
                    if (!isNaN(templateId) && deps.handleTemplateUse) {
                        await deps.handleTemplateUse(interaction, templateId);
                    }
                    return;
                }
            }
            catch (error) {
                logger_1.logger.error('Error during button interaction handling:', error);
                try {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: 'An error occurred while processing the button action.', flags: discord_js_1.MessageFlags.Ephemeral });
                    }
                    else {
                        await interaction.followUp({ content: 'An error occurred while processing the button action.', flags: discord_js_1.MessageFlags.Ephemeral }).catch(logger_1.logger.error);
                    }
                }
                catch (e) {
                    logger_1.logger.error('Failed to send error message as well:', e);
                }
            }
        }
        if (interaction.isStringSelectMenu() && interaction.customId === 'mode_select') {
            if (!deps.config.allowedUserIds.includes(interaction.user.id)) {
                await interaction.reply({ content: (0, i18n_1.t)('You do not have permission.'), flags: discord_js_1.MessageFlags.Ephemeral }).catch(logger_1.logger.error);
                return;
            }
            try {
                await interaction.deferUpdate();
            }
            catch (deferError) {
                if (deferError?.code === 10062 || deferError?.code === 40060) {
                    logger_1.logger.warn('[Mode] deferUpdate expired. Skipping.');
                    return;
                }
                logger_1.logger.error('[Mode] deferUpdate failed:', deferError);
                return;
            }
            try {
                const selectedMode = interaction.values[0];
                deps.modeService.setMode(selectedMode);
                const cdp = deps.getCurrentCdp(deps.bridge);
                if (cdp) {
                    const res = await cdp.setUiMode(selectedMode);
                    if (!res.ok) {
                        logger_1.logger.warn(`[Mode] UI mode switch failed: ${res.error}`);
                    }
                }
                await deps.sendModeUI({ editReply: async (data) => await interaction.editReply(data) }, deps.modeService);
                await interaction.followUp({ content: `Mode changed to **${modeService_1.MODE_DISPLAY_NAMES[selectedMode] || selectedMode}**!`, flags: discord_js_1.MessageFlags.Ephemeral });
            }
            catch (error) {
                logger_1.logger.error('Error during mode dropdown handling:', error);
                try {
                    if (interaction.deferred || interaction.replied) {
                        await interaction.followUp({ content: 'An error occurred while changing the mode.', flags: discord_js_1.MessageFlags.Ephemeral }).catch(logger_1.logger.error);
                    }
                }
                catch (e) {
                    logger_1.logger.error('Failed to send error message:', e);
                }
            }
            return;
        }
        if (interaction.isStringSelectMenu() && (0, sessionPickerUi_1.isSessionSelectId)(interaction.customId)) {
            if (!deps.config.allowedUserIds.includes(interaction.user.id)) {
                await interaction.reply({ content: (0, i18n_1.t)('You do not have permission.'), flags: discord_js_1.MessageFlags.Ephemeral }).catch(logger_1.logger.error);
                return;
            }
            try {
                await interaction.deferUpdate();
            }
            catch (deferError) {
                if (deferError?.code === 10062 || deferError?.code === 40060) {
                    logger_1.logger.warn('[SessionSelect] deferUpdate expired. Skipping.');
                    return;
                }
                logger_1.logger.error('[SessionSelect] deferUpdate failed:', deferError);
                return;
            }
            try {
                if (deps.joinHandler) {
                    await deps.joinHandler.handleJoinSelect(interaction, deps.bridge);
                }
            }
            catch (error) {
                logger_1.logger.error('Session selection error:', error);
            }
            return;
        }
        if (interaction.isStringSelectMenu() && (0, projectListUi_1.isProjectSelectId)(interaction.customId)) {
            if (!deps.config.allowedUserIds.includes(interaction.user.id)) {
                await interaction.reply({ content: (0, i18n_1.t)('You do not have permission.'), flags: discord_js_1.MessageFlags.Ephemeral }).catch(logger_1.logger.error);
                return;
            }
            if (!interaction.guild) {
                await interaction.reply({ content: 'This can only be used in a server.', flags: discord_js_1.MessageFlags.Ephemeral }).catch(logger_1.logger.error);
                return;
            }
            try {
                await deps.wsHandler.handleSelectMenu(interaction, interaction.guild);
            }
            catch (error) {
                logger_1.logger.error('Workspace selection error:', error);
            }
            return;
        }
        if (!interaction.isChatInputCommand())
            return;
        const commandInteraction = interaction;
        if (!deps.config.allowedUserIds.includes(interaction.user.id)) {
            await commandInteraction.reply({
                content: 'You do not have permission to use this command.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            }).catch(logger_1.logger.error);
            return;
        }
        try {
            if (commandInteraction.commandName === 'logs') {
                await commandInteraction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            }
            else {
                await commandInteraction.deferReply();
            }
        }
        catch (deferError) {
            if (deferError?.code === 10062) {
                logger_1.logger.warn('[SlashCommand] Interaction expired (deferReply failed). Skipping.');
                return;
            }
            throw deferError;
        }
        try {
            await deps.handleSlashInteraction(commandInteraction, deps.slashCommandHandler, deps.bridge, deps.wsHandler, deps.chatHandler, deps.cleanupHandler, deps.modeService, deps.modelService, deps.bridge.autoAccept, deps.client);
        }
        catch (error) {
            logger_1.logger.error('Error during slash command handling:', error);
            try {
                await commandInteraction.editReply({ content: 'An error occurred while processing the command.' });
            }
            catch (replyError) {
                logger_1.logger.error('Failed to send error response:', replyError);
            }
        }
    };
}
