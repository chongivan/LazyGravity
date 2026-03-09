"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initI18n = initI18n;
exports.t = t;
const logger_1 = require("./logger");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let currentLanguage = 'en';
let translations = {};
function initI18n(lang = 'en') {
    currentLanguage = lang;
    loadTranslations();
}
function loadTranslations() {
    try {
        const enPath = path.join(__dirname, '../../locales/en.json');
        const jaPath = path.join(__dirname, '../../locales/ja.json');
        if (fs.existsSync(enPath)) {
            translations['en'] = JSON.parse(fs.readFileSync(enPath, 'utf8'));
        }
        else {
            translations['en'] = {};
        }
        if (fs.existsSync(jaPath)) {
            translations['ja'] = JSON.parse(fs.readFileSync(jaPath, 'utf8'));
        }
        else {
            translations['ja'] = {};
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to load translations:', error);
    }
}
function t(key, variables) {
    const langDict = translations[currentLanguage] || translations['en'];
    let text = langDict?.[key] || translations['en']?.[key] || key;
    if (variables) {
        for (const [vKey, vValue] of Object.entries(variables)) {
            text = text.replace(new RegExp(`{{${vKey}}}`, 'g'), String(vValue));
        }
    }
    return text;
}
