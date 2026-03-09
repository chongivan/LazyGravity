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
exports.isImageAttachment = isImageAttachment;
exports.mimeTypeToExtension = mimeTypeToExtension;
exports.sanitizeFileName = sanitizeFileName;
exports.buildPromptWithAttachmentUrls = buildPromptWithAttachmentUrls;
exports.downloadInboundImageAttachments = downloadInboundImageAttachments;
exports.cleanupInboundImageAttachments = cleanupInboundImageAttachments;
exports.toDiscordAttachment = toDiscordAttachment;
const discord_js_1 = require("discord.js");
const fs = __importStar(require("fs/promises"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const logger_1 = require("./logger");
const MAX_INBOUND_IMAGE_ATTACHMENTS = 4;
const IMAGE_EXT_PATTERN = /\.(png|jpe?g|webp|gif|bmp)$/i;
const TEMP_IMAGE_DIR = path.join(os.tmpdir(), 'lazy-gravity-images');
function isImageAttachment(contentType, fileName) {
    if ((contentType || '').toLowerCase().startsWith('image/'))
        return true;
    return IMAGE_EXT_PATTERN.test(fileName || '');
}
function mimeTypeToExtension(mimeType) {
    const normalized = (mimeType || '').toLowerCase();
    if (normalized.includes('jpeg') || normalized.includes('jpg'))
        return 'jpg';
    if (normalized.includes('webp'))
        return 'webp';
    if (normalized.includes('gif'))
        return 'gif';
    if (normalized.includes('bmp'))
        return 'bmp';
    return 'png';
}
function sanitizeFileName(fileName) {
    const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
    return sanitized || `image-${Date.now()}.png`;
}
function buildPromptWithAttachmentUrls(prompt, attachments) {
    const base = prompt.trim() || 'Please review the attached images and respond accordingly.';
    if (attachments.length === 0)
        return base;
    const lines = attachments.map((image, index) => `${index + 1}. ${image.name}\nURL: ${image.url}`);
    return `${base}\n\n[Discord Attached Images]\n${lines.join('\n\n')}\n\nPlease refer to the attached images above in your response.`;
}
async function downloadInboundImageAttachments(message) {
    const allAttachments = Array.from(message.attachments.values());
    const imageAttachments = allAttachments
        .filter((attachment) => isImageAttachment(attachment.contentType, attachment.name))
        .slice(0, MAX_INBOUND_IMAGE_ATTACHMENTS);
    if (imageAttachments.length === 0)
        return [];
    await fs.mkdir(TEMP_IMAGE_DIR, { recursive: true });
    const downloaded = [];
    let index = 0;
    for (const attachment of imageAttachments) {
        try {
            const response = await fetch(attachment.url);
            if (!response.ok) {
                logger_1.logger.warn(`[ImageBridge] Attachment image download failed (id=${attachment.id || 'unknown'}, status=${response.status})`);
                continue;
            }
            const bytes = Buffer.from(await response.arrayBuffer());
            if (bytes.length === 0)
                continue;
            const mimeType = attachment.contentType || 'image/png';
            const hasExt = IMAGE_EXT_PATTERN.test(attachment.name || '');
            const ext = mimeTypeToExtension(mimeType);
            const originalName = sanitizeFileName(attachment.name || `discord-image-${index + 1}.${ext}`);
            const name = hasExt ? originalName : `${originalName}.${ext}`;
            const localPath = path.join(TEMP_IMAGE_DIR, `${Date.now()}-${message.id}-${index}-${name}`);
            await fs.writeFile(localPath, bytes);
            downloaded.push({
                localPath,
                url: attachment.url,
                name,
                mimeType,
            });
            index += 1;
        }
        catch (error) {
            logger_1.logger.warn(`[ImageBridge] Attachment image processing failed (id=${attachment.id || 'unknown'})`, error?.message || error);
        }
    }
    return downloaded;
}
async function cleanupInboundImageAttachments(attachments) {
    for (const image of attachments) {
        await fs.unlink(image.localPath).catch(() => { });
    }
}
async function toDiscordAttachment(image, index) {
    let buffer = null;
    let mimeType = image.mimeType || 'image/png';
    if (image.base64Data) {
        try {
            buffer = Buffer.from(image.base64Data, 'base64');
        }
        catch {
            buffer = null;
        }
    }
    else if (image.url && /^https?:\/\//i.test(image.url)) {
        try {
            const response = await fetch(image.url);
            if (response.ok) {
                buffer = Buffer.from(await response.arrayBuffer());
                mimeType = response.headers.get('content-type') || mimeType;
            }
        }
        catch {
            buffer = null;
        }
    }
    if (!buffer || buffer.length === 0)
        return null;
    const fallbackExt = mimeTypeToExtension(mimeType);
    const baseName = sanitizeFileName(image.name || `generated-image-${index + 1}.${fallbackExt}`);
    const finalName = IMAGE_EXT_PATTERN.test(baseName) ? baseName : `${baseName}.${fallbackExt}`;
    return new discord_js_1.AttachmentBuilder(buffer, { name: finalName });
}
