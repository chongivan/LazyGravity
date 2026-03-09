"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ITEMS_PER_PAGE = exports.PROJECT_PAGE_PREFIX = exports.WORKSPACE_SELECT_ID = exports.PROJECT_SELECT_ID = void 0;
exports.parseProjectPageId = parseProjectPageId;
exports.isProjectSelectId = isProjectSelectId;
exports.buildProjectListPayload = buildProjectListPayload;
exports.buildProjectListUI = buildProjectListUI;
const discord_js_1 = require("discord.js");
const i18n_1 = require("../utils/i18n");
const richContentBuilder_1 = require("../platform/richContentBuilder");
/** Select menu custom ID (legacy, page 0) */
exports.PROJECT_SELECT_ID = 'project_select';
/** Backward compatibility: also accept old ID */
exports.WORKSPACE_SELECT_ID = 'workspace_select';
/** Button customId prefix for page navigation. Format: project_page:<page> */
exports.PROJECT_PAGE_PREFIX = 'project_page';
/** Maximum items per page (Discord select menu limit) */
exports.ITEMS_PER_PAGE = 25;
/**
 * Parse page number from a page-button customId.
 * Returns NaN if the customId does not match the expected format.
 */
function parseProjectPageId(customId) {
    if (!customId.startsWith(`${exports.PROJECT_PAGE_PREFIX}:`))
        return NaN;
    return parseInt(customId.slice(exports.PROJECT_PAGE_PREFIX.length + 1), 10);
}
/**
 * Check if a customId belongs to a project select menu.
 * Matches legacy IDs (`project_select`, `workspace_select`) and
 * paginated IDs (`project_select:<page>`).
 */
function isProjectSelectId(customId) {
    return (customId === exports.PROJECT_SELECT_ID ||
        customId === exports.WORKSPACE_SELECT_ID ||
        customId.startsWith(`${exports.PROJECT_SELECT_ID}:`));
}
/**
 * Build a platform-agnostic MessagePayload for project list UI.
 */
function buildProjectListPayload(workspaces, page = 0) {
    const totalPages = Math.max(1, Math.ceil(workspaces.length / exports.ITEMS_PER_PAGE));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    let rc = (0, richContentBuilder_1.withTimestamp)((0, richContentBuilder_1.withColor)((0, richContentBuilder_1.withTitle)((0, richContentBuilder_1.withDescription)((0, richContentBuilder_1.createRichContent)(), (0, i18n_1.t)('Select a project to auto-create a category and session channel')), 'Projects'), 0x5865F2));
    if (workspaces.length === 0) {
        rc = (0, richContentBuilder_1.withDescription)(rc, (0, i18n_1.t)('No projects found.\nCreate a project directory in your workspace base folder, then try again.'));
        return { richContent: rc, components: [] };
    }
    if (totalPages > 1) {
        rc = (0, richContentBuilder_1.withFooter)(rc, `Page ${safePage + 1} / ${totalPages} (${workspaces.length} projects total)`);
    }
    const start = safePage * exports.ITEMS_PER_PAGE;
    const end = Math.min(start + exports.ITEMS_PER_PAGE, workspaces.length);
    const pageItems = workspaces.slice(start, end);
    const components = [
        {
            components: [
                {
                    type: 'selectMenu',
                    customId: `${exports.PROJECT_SELECT_ID}:${safePage}`,
                    placeholder: (0, i18n_1.t)('Select a project...'),
                    options: pageItems.map((ws) => ({
                        label: ws,
                        value: ws,
                    })),
                },
            ],
        },
    ];
    if (totalPages > 1) {
        components.push({
            components: [
                {
                    type: 'button',
                    customId: `${exports.PROJECT_PAGE_PREFIX}:${Math.max(0, safePage - 1)}`,
                    label: '\u25C0 Prev',
                    style: 'secondary',
                    disabled: safePage === 0,
                },
                {
                    type: 'button',
                    customId: `${exports.PROJECT_PAGE_PREFIX}:${safePage + 1}`,
                    label: 'Next \u25B6',
                    style: 'secondary',
                    disabled: safePage >= totalPages - 1,
                },
            ],
        });
    }
    return { richContent: rc, components };
}
/**
 * Build the project list UI with select menu and optional Prev/Next buttons.
 *
 * @param workspaces - Full list of workspace names
 * @param page - Zero-based page index (clamped to valid range)
 * @returns Object with embeds and components arrays ready for Discord reply
 */
function buildProjectListUI(workspaces, page = 0) {
    const totalPages = Math.max(1, Math.ceil(workspaces.length / exports.ITEMS_PER_PAGE));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('\u{1F4C1} Projects')
        .setColor(0x5865F2)
        .setDescription((0, i18n_1.t)('Select a project to auto-create a category and session channel'))
        .setTimestamp();
    if (workspaces.length === 0) {
        embed.setDescription((0, i18n_1.t)('No projects found.\nCreate a project directory in your workspace base folder, then try again.'));
        return { embeds: [embed], components: [] };
    }
    const start = safePage * exports.ITEMS_PER_PAGE;
    const end = Math.min(start + exports.ITEMS_PER_PAGE, workspaces.length);
    const pageItems = workspaces.slice(start, end);
    if (totalPages > 1) {
        embed.setFooter({
            text: `Page ${safePage + 1} / ${totalPages} (${workspaces.length} projects total)`,
        });
    }
    const components = [];
    const options = pageItems.map((ws) => ({ label: ws, value: ws }));
    const selectMenu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(`${exports.PROJECT_SELECT_ID}:${safePage}`)
        .setPlaceholder((0, i18n_1.t)('Select a project...'))
        .addOptions(options);
    components.push(new discord_js_1.ActionRowBuilder().addComponents(selectMenu));
    if (totalPages > 1) {
        const prevBtn = new discord_js_1.ButtonBuilder()
            .setCustomId(`${exports.PROJECT_PAGE_PREFIX}:${Math.max(0, safePage - 1)}`)
            .setLabel('\u25C0 Prev')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setDisabled(safePage === 0);
        const nextBtn = new discord_js_1.ButtonBuilder()
            .setCustomId(`${exports.PROJECT_PAGE_PREFIX}:${safePage + 1}`)
            .setLabel('Next \u25B6')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setDisabled(safePage >= totalPages - 1);
        components.push(new discord_js_1.ActionRowBuilder().addComponents(prevBtn, nextBtn));
    }
    return { embeds: [embed], components };
}
