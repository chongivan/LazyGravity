"use strict";
/**
 * Format embed-like data as plain text for Discord messages.
 * Used when user has output format set to 'plain'.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitPlainText = splitPlainText;
exports.formatAsPlainText = formatAsPlainText;
/**
 * Split text into chunks at line boundaries, respecting Discord's 2000 char limit.
 * Uses maxLength of 1900 to leave room for formatting overhead.
 */
function splitPlainText(text, maxLength = 1900) {
    if (text.length <= maxLength)
        return [text];
    const lines = text.split('\n');
    const chunks = [];
    let current = '';
    const flush = () => {
        if (!current)
            return;
        chunks.push(current);
        current = '';
    };
    for (const line of lines) {
        const candidate = current ? `${current}\n${line}` : line;
        if (candidate.length <= maxLength) {
            current = candidate;
            continue;
        }
        flush();
        if (line.length <= maxLength) {
            current = line;
            continue;
        }
        // Line itself exceeds maxLength — hard-split
        let cursor = 0;
        while (cursor < line.length) {
            chunks.push(line.slice(cursor, cursor + maxLength));
            cursor += maxLength;
        }
    }
    flush();
    return chunks.length > 0 ? chunks : [''];
}
/**
 * Convert embed-style data to a plain text string array (chunked for Discord).
 * Format: **{title}**\n{description}\n\n{field.name}: {field.value}\n...\n_{footer}_
 */
function formatAsPlainText(input) {
    const parts = [];
    if (input.title) {
        parts.push(`**${input.title}**`);
    }
    if (input.description) {
        parts.push(input.description);
    }
    if (input.fields && input.fields.length > 0) {
        parts.push(''); // blank line separator
        for (const field of input.fields) {
            parts.push(`**${field.name}:** ${field.value}`);
        }
    }
    if (input.footerText) {
        parts.push(''); // blank line separator
        parts.push(`_${input.footerText}_`);
    }
    const text = parts.join('\n');
    return splitPlainText(text);
}
