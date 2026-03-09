"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessLogBuffer = void 0;
const DEFAULT_MAX_CHARS = 3500;
const DEFAULT_MAX_ENTRIES = 120;
const DEFAULT_MAX_ENTRY_LENGTH = 260;
function collapseWhitespace(text) {
    return (text || '').replace(/\r/g, '').replace(/\s+/g, ' ').trim();
}
function parseBlocks(raw) {
    const normalized = (raw || '').replace(/\r/g, '').trim();
    if (!normalized)
        return [];
    const blocks = normalized
        .split(/\n{2,}/)
        .map((chunk) => collapseWhitespace(chunk))
        .filter((chunk) => chunk.length > 0);
    if (blocks.length > 0)
        return blocks;
    return normalized
        .split('\n')
        .map((line) => collapseWhitespace(line))
        .filter((line) => line.length > 0);
}
function pickEmoji(entry) {
    const lower = entry.toLowerCase();
    if (/^thought for\b/.test(lower) || /^thinking\b/.test(lower))
        return '🧠';
    if (/^initiating\b/.test(lower) || /^starting\b/.test(lower))
        return '🚀';
    if (/^[a-z0-9._-]+\s*\/\s*[a-z0-9._-]+$/i.test(entry))
        return '🛠️';
    if (/^(?:analy[sz]ed|read|wrote|created|updated|deleted|built|compiled|installed|resolved|downloaded|connected|fetched)\b/i.test(entry))
        return '📄';
    if (/^(?:analy[sz]ing|reading|writing|running|searching|fetching|checking|scanning|creating|updating|deleting|building|compiling|deploying|parsing|resolving|downloading|uploading|connecting|installing|executing|testing|debugging|processing|loading)\b/i.test(entry))
        return '🔍';
    if (/^title:\s/.test(lower) && /\surl:\s/.test(lower))
        return '🔎';
    if (/^(json|javascript|typescript|python|bash|sh|html|css|xml|yaml|yml|toml|sql|graphql|markdown|text|plaintext|log)$/i.test(entry))
        return '📦';
    return '•';
}
function toDisplayEntry(rawEntry, maxEntryLength) {
    const trimmed = collapseWhitespace(rawEntry);
    if (!trimmed)
        return '';
    const clipped = trimmed.length > maxEntryLength
        ? `${trimmed.slice(0, Math.max(0, maxEntryLength - 3))}...`
        : trimmed;
    return `${pickEmoji(clipped)} ${clipped}`;
}
class ProcessLogBuffer {
    maxChars;
    maxEntries;
    maxEntryLength;
    entries = [];
    seen = new Set();
    constructor(options = {}) {
        this.maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
        this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
        this.maxEntryLength = options.maxEntryLength ?? DEFAULT_MAX_ENTRY_LENGTH;
    }
    append(raw) {
        const blocks = parseBlocks(raw);
        for (const block of blocks) {
            const display = toDisplayEntry(block, this.maxEntryLength);
            if (!display)
                continue;
            const key = display.toLowerCase();
            if (this.seen.has(key))
                continue;
            this.entries.push(display);
            this.seen.add(key);
        }
        this.trim();
        return this.snapshot();
    }
    snapshot() {
        return this.entries.join('\n');
    }
    trim() {
        while (this.entries.length > this.maxEntries) {
            this.dropOldest();
        }
        while (this.entries.length > 1 && this.snapshot().length > this.maxChars) {
            this.dropOldest();
        }
        if (this.entries.length === 1 && this.entries[0].length > this.maxChars) {
            const only = this.entries[0];
            this.entries[0] = `${only.slice(0, Math.max(0, this.maxChars - 3))}...`;
            this.seen.clear();
            this.seen.add(this.entries[0].toLowerCase());
        }
    }
    dropOldest() {
        const removed = this.entries.shift();
        if (!removed)
            return;
        this.seen.delete(removed.toLowerCase());
    }
}
exports.ProcessLogBuffer = ProcessLogBuffer;
