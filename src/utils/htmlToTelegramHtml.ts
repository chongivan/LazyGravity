/**
 * Direct HTML-to-Telegram-HTML converter.
 *
 * Uses node-html-parser to parse AG's innerHTML and recursively walks
 * the DOM tree, mapping each element to Telegram's supported HTML subset.
 *
 * Telegram supported tags:
 *   <b>, <strong>, <i>, <em>, <u>, <ins>, <s>, <strike>, <del>,
 *   <code>, <pre> (with optional <code class="language-xxx">),
 *   <a href>, <blockquote> (with optional expandable attr),
 *   <tg-spoiler>, <span class="tg-spoiler">
 *
 * Everything else is stripped with text preserved.
 */

import { parse, HTMLElement, TextNode, NodeType, Node as HtmlNode } from 'node-html-parser';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert AG's raw HTML to Telegram-compatible HTML.
 */
export function htmlToTelegramHtml(html: string): string {
    if (!html) return '';

    const root = parse(html, {
        lowerCaseTagName: true,
        comment: false,
    });

    const raw = walkNode(root);

    // Collapse 3+ newlines → 2
    return raw.replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------------------
// Recursive DOM walker
// ---------------------------------------------------------------------------

function walkNode(node: HtmlNode): string {
    // Text node — escape for Telegram
    if (node.nodeType === NodeType.TEXT_NODE) {
        return escapeHtml((node as TextNode).rawText);
    }

    // Not an element — skip
    if (node.nodeType !== NodeType.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName?.toLowerCase();

    // Skip completely: <style>, <script>
    if (tag === 'style' || tag === 'script') return '';

    // Process children first (recursive)
    const children = el.childNodes.map(walkNode).join('');

    switch (tag) {
        // ----- Headings → bold (Telegram has no heading tags) -----
        case 'h1':
            return `\n\n📌 <b>${children.trim()}</b>\n`;
        case 'h2':
            return `\n\n<b>${children.trim()}</b>\n`;
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
            return `\n<b>${children.trim()}</b>\n`;

        // ----- Passthrough tags (Telegram-native) -----
        case 'b':
        case 'strong':
            return `<b>${children}</b>`;
        case 'i':
        case 'em':
            return `<i>${children}</i>`;
        case 'u':
        case 'ins':
            return `<u>${children}</u>`;
        case 's':
        case 'strike':
        case 'del':
            return `<s>${children}</s>`;

        // ----- Code -----
        case 'pre':
            return handlePre(el);
        case 'code':
            // Inline code (not inside <pre>, that's handled by handlePre)
            return `<code>${escapeHtml(el.textContent)}</code>`;

        // ----- Links -----
        case 'a':
            return handleLink(el, children);

        // ----- Blockquote (Telegram supports natively!) -----
        case 'blockquote': {
            const expandable = el.hasAttribute('expandable') ? ' expandable' : '';
            return `\n<blockquote${expandable}>${children.trim()}</blockquote>\n`;
        }

        // ----- Spoiler -----
        case 'tg-spoiler':
            return `<tg-spoiler>${children}</tg-spoiler>`;

        // ----- Lists → manual bullets/numbers -----
        case 'ul':
            return handleUnorderedList(el);
        case 'ol':
            return handleOrderedList(el);
        case 'li':
            // Shouldn't be hit directly (handled by list handlers),
            // but just in case:
            return children;

        // ----- Block elements -----
        case 'p':
            return `${children.trim()}\n\n`;
        case 'div':
            return handleDiv(el, children);
        case 'br':
            return '\n';
        case 'hr':
            return '\n──────────\n';

        // ----- Table → <pre> monospace -----
        case 'table':
            return handleTable(el);

        // ----- AG-specific: context-scope-mention spans -----
        case 'span':
            return handleSpan(el, children);

        // ----- Root/wrapper nodes — just pass children through -----
        case undefined:
        case '':
            return children;

        // ----- Everything else: strip tag, keep text -----
        default:
            return children;
    }
}

// ---------------------------------------------------------------------------
// Element-specific handlers
// ---------------------------------------------------------------------------

/** Handle <pre> blocks — extract language from inner <code> */
function handlePre(el: HTMLElement): string {
    const codeEl = el.querySelector('code');
    let lang = '';
    let text: string;

    if (codeEl) {
        // Extract language from class="language-xxx"
        const cls = codeEl.getAttribute('class') || '';
        const langMatch = cls.match(/language-(\S+)/);
        if (langMatch) lang = langMatch[1];
        text = codeEl.textContent;
    } else {
        text = el.textContent;
    }

    // Escape HTML entities in code content
    const escaped = escapeHtml(text);

    if (lang) {
        return `\n<pre><code class="language-${escapeHtml(lang)}">${escaped}</code></pre>\n`;
    }
    return `\n<pre>${escaped}</pre>\n`;
}

/** Handle <a> links — preserve href */
function handleLink(el: HTMLElement, children: string): string {
    const href = el.getAttribute('href');
    if (!href) return children;
    return `<a href="${escapeHtml(href)}">${children}</a>`;
}

/** Handle <ul> → bullet list */
function handleUnorderedList(el: HTMLElement): string {
    const items = el.querySelectorAll(':scope > li');
    if (items.length === 0) return walkChildren(el);

    const lines = items.map((li) => {
        const content = walkNode(li).trim();
        return `• ${content}`;
    });

    return '\n' + lines.join('\n') + '\n';
}

/** Handle <ol> → numbered list */
function handleOrderedList(el: HTMLElement): string {
    const items = el.querySelectorAll(':scope > li');
    if (items.length === 0) return walkChildren(el);

    const lines = items.map((li, idx) => {
        const content = walkNode(li).trim();
        return `${idx + 1}. ${content}`;
    });

    return '\n' + lines.join('\n') + '\n';
}

/** Handle <div> — AG-specific file refs, or generic block */
function handleDiv(el: HTMLElement, children: string): string {
    const title = el.getAttribute('title');
    if (title && looksLikeFilePath(title)) {
        const lineText = el.textContent.trim();
        return `<code>${escapeHtml(title)}${escapeHtml(lineText)}</code>`;
    }

    // Generic div: emit content with a newline (only if non-empty)
    const trimmed = children.trim();
    if (!trimmed) return '';
    return `${trimmed}\n`;
}

/** Handle <span> — AG context-scope-mention or passthrough */
function handleSpan(el: HTMLElement, children: string): string {
    const cls = el.getAttribute('class') || '';

    // AG file reference pills
    if (cls.includes('context-scope-mention')) {
        return `<code>${escapeHtml(el.textContent.trim())}</code>`;
    }

    // Telegram spoiler
    if (cls.includes('tg-spoiler')) {
        return `<tg-spoiler>${children}</tg-spoiler>`;
    }

    // Generic span → just pass children
    return children;
}

/** Handle <table> → monospace ASCII inside <pre> */
function handleTable(el: HTMLElement): string {
    const rows = el.querySelectorAll('tr');
    if (rows.length === 0) return '';

    // Extract all rows as arrays of cell text
    const data: string[][] = [];
    for (const row of rows) {
        const cells = row.querySelectorAll('th, td');
        data.push(cells.map((c) => c.textContent.trim()));
    }

    // Calculate column widths
    const colCount = Math.max(...data.map((r) => r.length));
    const colWidths: number[] = [];
    for (let c = 0; c < colCount; c++) {
        colWidths.push(Math.max(...data.map((r) => (r[c] || '').length), 3));
    }

    // Render rows
    const lines: string[] = [];
    for (let r = 0; r < data.length; r++) {
        const cells = data[r];
        const line = cells
            .map((cell, c) => cell.padEnd(colWidths[c]))
            .join(' | ');
        lines.push('| ' + line + ' |');

        // Add separator after header row (first row)
        if (r === 0) {
            const sep = colWidths.map((w) => '-'.repeat(w)).join('-|-');
            lines.push('|-' + sep + '-|');
        }
    }

    return `\n<pre>${escapeHtml(lines.join('\n'))}</pre>\n`;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Walk all child nodes and concatenate their output */
function walkChildren(el: HTMLElement): string {
    return el.childNodes.map(walkNode).join('');
}

/** Escape characters for Telegram HTML (bare <, >, & must be escaped) */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** Check if a string looks like a file path */
function looksLikeFilePath(value: string): boolean {
    if (!value) return false;
    return /^[a-zA-Z0-9._\-/\\]+\.[a-zA-Z0-9]+$/.test(value) && (value.includes('/') || value.includes('\\'));
}
