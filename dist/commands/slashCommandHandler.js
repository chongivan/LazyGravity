"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlashCommandHandler = void 0;
const i18n_1 = require("../utils/i18n");
class SlashCommandHandler {
    templateRepo;
    constructor(templateRepo) {
        this.templateRepo = templateRepo;
    }
    /**
     * Parse the slash command name and arguments, then route to the appropriate handler
     */
    async handleCommand(commandName, args) {
        switch (commandName.toLowerCase()) {
            case 'template':
                return this.handleTemplateCommand(args);
            default:
                return {
                    success: false,
                    message: (0, i18n_1.t)(`⚠️ Unknown command: /${commandName}`),
                };
        }
    }
    handleTemplateCommand(args) {
        if (args.length === 0) {
            const templates = this.templateRepo.findAll();
            if (templates.length === 0) {
                return {
                    success: true,
                    message: (0, i18n_1.t)('📝 No templates registered.'),
                };
            }
            const list = templates.map((t) => `- **${t.name}**`).join('\n');
            return {
                success: true,
                message: (0, i18n_1.t)(`📝 Registered Templates:\n${list}\n\nTo use: \`/template [name]\``),
            };
        }
        const subCommandOrName = args[0];
        // add: register new template
        if (subCommandOrName.toLowerCase() === 'add') {
            if (args.length < 3) {
                return {
                    success: false,
                    message: (0, i18n_1.t)('⚠️ Missing arguments.\nUsage: `/template add "name" "prompt"`'),
                };
            }
            const name = args[1];
            // Quotes already stripped by messageParser. Join remaining args as the prompt
            const prompt = args.slice(2).join(' ');
            try {
                this.templateRepo.create({ name, prompt });
                return {
                    success: true,
                    message: (0, i18n_1.t)(`✅ Template **${name}** registered.`),
                };
            }
            catch (e) {
                return {
                    success: false,
                    message: (0, i18n_1.t)(`⚠️ Failed to register template. Name might be duplicated.`),
                };
            }
        }
        // delete: remove template
        if (subCommandOrName.toLowerCase() === 'delete') {
            if (args.length < 2) {
                return {
                    success: false,
                    message: (0, i18n_1.t)('⚠️ Specify a template name to delete.\nUsage: `/template delete "name"`'),
                };
            }
            const name = args[1];
            const deleted = this.templateRepo.deleteByName(name);
            if (deleted) {
                return {
                    success: true,
                    message: (0, i18n_1.t)(`🗑️ Template **${name}** deleted.`),
                };
            }
            else {
                return {
                    success: false,
                    message: (0, i18n_1.t)(`⚠️ Template **${name}** not found.`),
                };
            }
        }
        // Otherwise treat as template invocation
        const templateName = subCommandOrName;
        const template = this.templateRepo.findByName(templateName);
        if (!template) {
            return {
                success: false,
                message: (0, i18n_1.t)(`⚠️ Template **${templateName}** not found.`),
            };
        }
        return {
            success: true,
            message: (0, i18n_1.t)(`📝 Invoked template **${templateName}**.\nStarting process with this prompt.`),
            prompt: template.prompt,
        };
    }
}
exports.SlashCommandHandler = SlashCommandHandler;
