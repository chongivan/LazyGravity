"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceCommandHandler = exports.WORKSPACE_SELECT_ID = exports.PROJECT_SELECT_ID = void 0;
const i18n_1 = require("../utils/i18n");
const fs_1 = __importDefault(require("fs"));
const discord_js_1 = require("discord.js");
const projectListUi_1 = require("../ui/projectListUi");
// Re-export for backward compatibility
var projectListUi_2 = require("../ui/projectListUi");
Object.defineProperty(exports, "PROJECT_SELECT_ID", { enumerable: true, get: function () { return projectListUi_2.PROJECT_SELECT_ID; } });
Object.defineProperty(exports, "WORKSPACE_SELECT_ID", { enumerable: true, get: function () { return projectListUi_2.WORKSPACE_SELECT_ID; } });
/**
 * Handler for the /project slash command.
 * When a project is selected, auto-creates a Discord category + session-1 channel and binds them.
 */
class WorkspaceCommandHandler {
    bindingRepo;
    chatSessionRepo;
    workspaceService;
    channelManager;
    processingWorkspaces = new Set();
    constructor(bindingRepo, chatSessionRepo, workspaceService, channelManager) {
        this.bindingRepo = bindingRepo;
        this.chatSessionRepo = chatSessionRepo;
        this.workspaceService = workspaceService;
        this.channelManager = channelManager;
    }
    /**
     * /project list -- Display project list via select menu
     */
    async handleShow(interaction) {
        const workspaces = this.workspaceService.scanWorkspaces();
        const { embeds, components } = (0, projectListUi_1.buildProjectListUI)(workspaces, 0);
        await interaction.editReply({ embeds, components });
    }
    /**
     * Handle page navigation button press.
     * Re-scans workspaces and renders the requested page.
     */
    async handlePageButton(interaction, page) {
        await interaction.deferUpdate();
        const workspaces = this.workspaceService.scanWorkspaces();
        const { embeds, components } = (0, projectListUi_1.buildProjectListUI)(workspaces, page);
        await interaction.editReply({ embeds, components });
    }
    /**
     * Handler for when a project is selected from the select menu.
     * Creates a category + session-1 channel and binds them.
     */
    async handleSelectMenu(interaction, guild) {
        const workspacePath = interaction.values[0];
        if (!this.workspaceService.exists(workspacePath)) {
            await interaction.update({
                content: (0, i18n_1.t)(`❌ Project \`${workspacePath}\` not found.`),
                embeds: [],
                components: [],
            });
            return;
        }
        // Check if the same project is already bound (prevent duplicates)
        const existingBindings = this.bindingRepo.findByWorkspacePathAndGuildId(workspacePath, guild.id);
        if (existingBindings.length > 0) {
            const channelLinks = existingBindings.map(b => `<#${b.channelId}>`).join(', ');
            const fullPath = this.workspaceService.getWorkspacePath(workspacePath);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('📁 Projects')
                .setColor(0xFFA500)
                .setDescription((0, i18n_1.t)(`⚠️ Project **${workspacePath}** already exists\n`) +
                `→ ${channelLinks}`)
                .addFields({ name: (0, i18n_1.t)('Full Path'), value: `\`${fullPath}\`` })
                .setTimestamp();
            await interaction.update({
                embeds: [embed],
                components: [],
            });
            return;
        }
        // Lock project being processed (prevent rapid repeated clicks)
        if (this.processingWorkspaces.has(workspacePath)) {
            await interaction.update({
                content: (0, i18n_1.t)(`⏳ **${workspacePath}** is being created. Please wait.`),
                embeds: [],
                components: [],
            });
            return;
        }
        this.processingWorkspaces.add(workspacePath);
        try {
            // Ensure category exists
            const categoryResult = await this.channelManager.ensureCategory(guild, workspacePath);
            const categoryId = categoryResult.categoryId;
            // Get session number (usually 1)
            const sessionNumber = this.chatSessionRepo.getNextSessionNumber(categoryId);
            const channelName = `session-${sessionNumber}`;
            // Create session channel
            const sessionResult = await this.channelManager.createSessionChannel(guild, categoryId, channelName);
            const channelId = sessionResult.channelId;
            // Register binding and session
            this.bindingRepo.upsert({
                channelId,
                workspacePath,
                guildId: guild.id,
            });
            this.chatSessionRepo.create({
                channelId,
                categoryId,
                workspacePath,
                sessionNumber,
                guildId: guild.id,
            });
            const fullPath = this.workspaceService.getWorkspacePath(workspacePath);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('📁 Projects')
                .setColor(0x00AA00)
                .setDescription((0, i18n_1.t)(`✅ Project **${workspacePath}** created\n`) +
                `→ <#${channelId}>`)
                .addFields({ name: (0, i18n_1.t)('Full Path'), value: `\`${fullPath}\`` })
                .setTimestamp();
            await interaction.update({
                embeds: [embed],
                components: [],
            });
        }
        finally {
            this.processingWorkspaces.delete(workspacePath);
        }
        return;
    }
    /**
     * /project create <name> -- Create a new project directory,
     * auto-create a category + session-1 channel and bind them.
     */
    async handleCreate(interaction, guild) {
        const name = interaction.options.getString('name', true);
        // Path traversal check
        let fullPath;
        try {
            fullPath = this.workspaceService.validatePath(name);
        }
        catch (e) {
            await interaction.editReply({
                content: (0, i18n_1.t)(`❌ Invalid project name: ${e.message}`),
            });
            return;
        }
        // Check for existing project
        if (this.workspaceService.exists(name)) {
            const existingBindings = this.bindingRepo.findByWorkspacePathAndGuildId(name, guild.id);
            if (existingBindings.length > 0) {
                const channelLinks = existingBindings.map(b => `<#${b.channelId}>`).join(', ');
                await interaction.editReply({
                    content: (0, i18n_1.t)(`⚠️ Project **${name}** already exists → ${channelLinks}`),
                });
                return;
            }
            // Directory exists but not bound -- continue
        }
        // Lock project being processed
        if (this.processingWorkspaces.has(name)) {
            await interaction.editReply({
                content: (0, i18n_1.t)(`⏳ **${name}** is being created.`),
            });
            return;
        }
        this.processingWorkspaces.add(name);
        try {
            if (!this.workspaceService.exists(name)) {
                // Create directory
                fs_1.default.mkdirSync(fullPath, { recursive: true });
            }
            // Ensure category exists
            const categoryResult = await this.channelManager.ensureCategory(guild, name);
            const categoryId = categoryResult.categoryId;
            // Get session number (usually 1)
            const sessionNumber = this.chatSessionRepo.getNextSessionNumber(categoryId);
            const channelName = `session-${sessionNumber}`;
            // Create session channel
            const sessionResult = await this.channelManager.createSessionChannel(guild, categoryId, channelName);
            const channelId = sessionResult.channelId;
            // Register binding and session
            this.bindingRepo.upsert({
                channelId,
                workspacePath: name,
                guildId: guild.id,
            });
            this.chatSessionRepo.create({
                channelId,
                categoryId,
                workspacePath: name,
                sessionNumber,
                guildId: guild.id,
            });
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('📁 Project Created')
                .setColor(0x00AA00)
                .setDescription((0, i18n_1.t)(`✅ Project **${name}** created\n`) +
                `→ <#${channelId}>`)
                .addFields({ name: (0, i18n_1.t)('Full Path'), value: `\`${fullPath}\`` })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        finally {
            this.processingWorkspaces.delete(name);
        }
    }
    /**
     * Get the bound project path from a channel ID
     */
    getWorkspaceForChannel(channelId) {
        const binding = this.bindingRepo.findByChannelId(channelId);
        if (!binding)
            return undefined;
        return this.workspaceService.getWorkspacePath(binding.workspacePath);
    }
}
exports.WorkspaceCommandHandler = WorkspaceCommandHandler;
