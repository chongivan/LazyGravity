"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slashCommands = void 0;
exports.registerSlashCommands = registerSlashCommands;
const logger_1 = require("../utils/logger");
const discord_js_1 = require("discord.js");
const i18n_1 = require("../utils/i18n");
/**
 * Slash command definitions for the Discord Interactions API.
 * Registers bot slash commands to the application.
 */
/** /mode command definition */
const modeCommand = new discord_js_1.SlashCommandBuilder()
    .setName('mode')
    .setDescription((0, i18n_1.t)('Display and change execution mode via a dropdown'));
/** /model command definition (formerly /models, unified to singular) */
const modelCommand = new discord_js_1.SlashCommandBuilder()
    .setName('model')
    .setDescription((0, i18n_1.t)('Display and change available LLM models'))
    .addStringOption((option) => option
    .setName('name')
    .setDescription((0, i18n_1.t)('Name of the model to change to'))
    .setRequired(false));
/** /template command definition (formerly /templates, unified to singular) */
const templateCommand = new discord_js_1.SlashCommandBuilder()
    .setName('template')
    .setDescription((0, i18n_1.t)('List, register, or delete templates'))
    .addSubcommand((sub) => sub
    .setName('list')
    .setDescription((0, i18n_1.t)('Display registered template list with execute buttons')))
    .addSubcommand((sub) => sub
    .setName('add')
    .setDescription((0, i18n_1.t)('Register a new template'))
    .addStringOption((option) => option
    .setName('name')
    .setDescription((0, i18n_1.t)('Template name'))
    .setRequired(true))
    .addStringOption((option) => option
    .setName('prompt')
    .setDescription((0, i18n_1.t)('Prompt content of the template'))
    .setRequired(true)))
    .addSubcommand((sub) => sub
    .setName('delete')
    .setDescription((0, i18n_1.t)('Delete a template'))
    .addStringOption((option) => option
    .setName('name')
    .setDescription((0, i18n_1.t)('Name of the template to delete'))
    .setRequired(true)));
/** /stop command definition */
const stopCommand = new discord_js_1.SlashCommandBuilder()
    .setName('stop')
    .setDescription((0, i18n_1.t)('Interrupt active LLM generation'));
/** /screenshot command definition */
const screenshotCommand = new discord_js_1.SlashCommandBuilder()
    .setName('screenshot')
    .setDescription((0, i18n_1.t)('Capture current Antigravity screen'));
/** /status command definition (formerly /cdp status, extended to overall bot status) */
const statusCommand = new discord_js_1.SlashCommandBuilder()
    .setName('status')
    .setDescription((0, i18n_1.t)('Display overall bot status including connection, model, mode'));
/** /autoaccept command definition */
const autoAcceptCommand = new discord_js_1.SlashCommandBuilder()
    .setName('autoaccept')
    .setDescription((0, i18n_1.t)('Display and toggle auto-allow mode for approval dialogs'))
    .addStringOption((option) => option
    .setName('mode')
    .setDescription((0, i18n_1.t)('on / off (optional direct switch)'))
    .setRequired(false));
/** /project command definition (formerly /workspace, renamed to project) */
const projectCommand = new discord_js_1.SlashCommandBuilder()
    .setName('project')
    .setDescription((0, i18n_1.t)('List projects, on select auto-create channel and bind'))
    .addSubcommand((sub) => sub
    .setName('list')
    .setDescription((0, i18n_1.t)('Display project list')))
    .addSubcommand((sub) => sub
    .setName('create')
    .setDescription((0, i18n_1.t)('Create a new project'))
    .addStringOption((option) => option
    .setName('name')
    .setDescription((0, i18n_1.t)('Name of the project to create'))
    .setRequired(true)));
/** /new command definition (formerly /chat new, made into a standalone command) */
const newCommand = new discord_js_1.SlashCommandBuilder()
    .setName('new')
    .setDescription((0, i18n_1.t)('Start a new chat session in the current project'));
/** /chat command definition (merged status + list) */
const chatCommand = new discord_js_1.SlashCommandBuilder()
    .setName('chat')
    .setDescription((0, i18n_1.t)('Display current chat session info and session list'));
/** /cleanup command definition */
const cleanupCommand = new discord_js_1.SlashCommandBuilder()
    .setName('cleanup')
    .setDescription((0, i18n_1.t)('Scan and clean up inactive session channels and categories'))
    .addIntegerOption((option) => option
    .setName('days')
    .setDescription((0, i18n_1.t)('Number of days of inactivity (default: 7)'))
    .setRequired(false)
    .setMinValue(1)
    .setMaxValue(365));
/** /help command definition */
const helpCommand = new discord_js_1.SlashCommandBuilder()
    .setName('help')
    .setDescription((0, i18n_1.t)('Display list of available commands'));
/** /join command definition */
const joinCommand = new discord_js_1.SlashCommandBuilder()
    .setName('join')
    .setDescription((0, i18n_1.t)('Join an existing Antigravity session (shows up to 20 recent sessions)'));
/** /mirror command definition */
const mirrorCommand = new discord_js_1.SlashCommandBuilder()
    .setName('mirror')
    .setDescription((0, i18n_1.t)('Toggle PC-to-Discord message mirroring for the current session'));
/** /output command definition */
const outputCommand = new discord_js_1.SlashCommandBuilder()
    .setName('output')
    .setDescription((0, i18n_1.t)('Toggle output format between Embed and Plain Text'))
    .addStringOption((option) => option
    .setName('format')
    .setDescription((0, i18n_1.t)('embed / plain (optional direct switch)'))
    .setRequired(false));
/** /logs command definition */
const logsCommand = new discord_js_1.SlashCommandBuilder()
    .setName('logs')
    .setDescription((0, i18n_1.t)('View recent bot logs'))
    .addIntegerOption((option) => option
    .setName('lines')
    .setDescription((0, i18n_1.t)('Number of recent log lines (default: 50)'))
    .setRequired(false)
    .setMinValue(1)
    .setMaxValue(100))
    .addStringOption((option) => option
    .setName('level')
    .setDescription((0, i18n_1.t)('Filter by log level'))
    .setRequired(false)
    .addChoices({ name: 'debug', value: 'debug' }, { name: 'info', value: 'info' }, { name: 'warn', value: 'warn' }, { name: 'error', value: 'error' }));
/** /ping command definition */
const pingCommand = new discord_js_1.SlashCommandBuilder()
    .setName('ping')
    .setDescription((0, i18n_1.t)('Check bot latency'));
/** Array of commands to register */
exports.slashCommands = [
    helpCommand,
    modeCommand,
    modelCommand,
    templateCommand,
    stopCommand,
    screenshotCommand,
    statusCommand,
    autoAcceptCommand,
    projectCommand,
    newCommand,
    chatCommand,
    cleanupCommand,
    joinCommand,
    mirrorCommand,
    outputCommand,
    pingCommand,
    logsCommand,
];
/**
 * Register slash commands with Discord
 * @param token Bot token
 * @param clientId Bot application ID
 * @param guildId Target guild (server) ID (global registration if omitted)
 */
async function registerSlashCommands(token, clientId, guildId) {
    const rest = new discord_js_1.REST({ version: '10' }).setToken(token);
    const commandData = exports.slashCommands.map((cmd) => cmd.toJSON());
    try {
        if (guildId) {
            // Guild-specific registration (takes effect immediately)
            await rest.put(discord_js_1.Routes.applicationGuildCommands(clientId, guildId), { body: commandData });
            logger_1.logger.info(`Registered ${commandData.length} slash commands to guild ${guildId}.`);
            // Clear global commands to avoid duplicate suggestions such as old legacy commands.
            // This bot is expected to run primarily in guild scope when guildId is provided.
            await rest.put(discord_js_1.Routes.applicationCommands(clientId), { body: [] });
            logger_1.logger.info('Cleared global slash commands to prevent duplicate command listings.');
        }
        else {
            // Global registration (may take up to 1 hour to take effect)
            await rest.put(discord_js_1.Routes.applicationCommands(clientId), { body: commandData });
            logger_1.logger.info(`Registered ${commandData.length} slash commands globally.`);
        }
    }
    catch (error) {
        logger_1.logger.error((0, i18n_1.t)('❌ Failed to register slash commands:'), error);
        throw error;
    }
}
