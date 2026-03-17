import { htmlToTelegramHtml, escapeHtml } from '../../src/utils/htmlToTelegramHtml';

describe('htmlToTelegramHtml', () => {
    // -------------------------------------------------------------------
    // Basic / edge cases
    // -------------------------------------------------------------------

    it('returns empty string for falsy input', () => {
        expect(htmlToTelegramHtml('')).toBe('');
        expect(htmlToTelegramHtml(null as any)).toBe('');
        expect(htmlToTelegramHtml(undefined as any)).toBe('');
    });

    it('passes through plain text unchanged', () => {
        expect(htmlToTelegramHtml('Hello world')).toBe('Hello world');
    });

    it('escapes bare < > & in text content', () => {
        expect(htmlToTelegramHtml('a < b && c > d')).toBe('a &lt; b &amp;&amp; c &gt; d');
    });

    // -------------------------------------------------------------------
    // Headings
    // -------------------------------------------------------------------

    describe('headings', () => {
        it('converts h1 to emoji + bold', () => {
            const result = htmlToTelegramHtml('<h1>Title</h1>');
            expect(result).toContain('📌');
            expect(result).toContain('<b>Title</b>');
        });

        it('converts h2 to bold', () => {
            const result = htmlToTelegramHtml('<h2>Subtitle</h2>');
            expect(result).toContain('<b>Subtitle</b>');
            expect(result).not.toContain('📌');
        });

        it('converts h3-h6 to bold', () => {
            expect(htmlToTelegramHtml('<h3>Section</h3>')).toContain('<b>Section</b>');
            expect(htmlToTelegramHtml('<h4>Sub</h4>')).toContain('<b>Sub</b>');
            expect(htmlToTelegramHtml('<h5>Deep</h5>')).toContain('<b>Deep</b>');
            expect(htmlToTelegramHtml('<h6>Deepest</h6>')).toContain('<b>Deepest</b>');
        });
    });

    // -------------------------------------------------------------------
    // Inline formatting (passthrough)
    // -------------------------------------------------------------------

    describe('inline formatting', () => {
        it('preserves bold tags', () => {
            expect(htmlToTelegramHtml('<strong>bold</strong>')).toBe('<b>bold</b>');
            expect(htmlToTelegramHtml('<b>bold</b>')).toBe('<b>bold</b>');
        });

        it('preserves italic tags', () => {
            expect(htmlToTelegramHtml('<em>italic</em>')).toBe('<i>italic</i>');
            expect(htmlToTelegramHtml('<i>italic</i>')).toBe('<i>italic</i>');
        });

        it('preserves underline tags', () => {
            expect(htmlToTelegramHtml('<u>underline</u>')).toBe('<u>underline</u>');
            expect(htmlToTelegramHtml('<ins>underline</ins>')).toBe('<u>underline</u>');
        });

        it('preserves strikethrough tags', () => {
            expect(htmlToTelegramHtml('<s>strike</s>')).toBe('<s>strike</s>');
            expect(htmlToTelegramHtml('<del>deleted</del>')).toBe('<s>deleted</s>');
            expect(htmlToTelegramHtml('<strike>struck</strike>')).toBe('<s>struck</s>');
        });

        it('handles nested inline formatting', () => {
            const result = htmlToTelegramHtml('<b>bold <i>italic</i></b>');
            expect(result).toBe('<b>bold <i>italic</i></b>');
        });
    });

    // -------------------------------------------------------------------
    // Code
    // -------------------------------------------------------------------

    describe('code', () => {
        it('converts inline code', () => {
            expect(htmlToTelegramHtml('<code>foo()</code>')).toBe('<code>foo()</code>');
        });

        it('escapes HTML inside inline code', () => {
            expect(htmlToTelegramHtml('<code>a < b</code>')).toBe('<code>a &lt; b</code>');
        });

        it('converts pre+code to code block', () => {
            const html = '<pre><code>const x = 1;\nconst y = 2;</code></pre>';
            const result = htmlToTelegramHtml(html);
            expect(result).toContain('<pre>');
            expect(result).toContain('const x = 1;');
            expect(result).toContain('</pre>');
        });

        it('preserves language class in code blocks', () => {
            const html = '<pre><code class="language-python">print("hi")</code></pre>';
            const result = htmlToTelegramHtml(html);
            expect(result).toContain('class="language-python"');
            expect(result).toContain('print(&quot;hi&quot;)');
        });

        it('handles pre without code wrapper', () => {
            const html = '<pre>plain preformatted</pre>';
            const result = htmlToTelegramHtml(html);
            expect(result).toContain('<pre>plain preformatted</pre>');
        });
    });

    // -------------------------------------------------------------------
    // Links
    // -------------------------------------------------------------------

    describe('links', () => {
        it('preserves links with href', () => {
            const html = '<a href="https://example.com">click</a>';
            expect(htmlToTelegramHtml(html)).toBe('<a href="https://example.com">click</a>');
        });

        it('escapes special chars in href', () => {
            const html = '<a href="https://x.com/search?q=a&b=c">link</a>';
            const result = htmlToTelegramHtml(html);
            expect(result).toContain('href="https://x.com/search?q=a&amp;b=c"');
        });

        it('strips link tag if no href', () => {
            expect(htmlToTelegramHtml('<a>orphan</a>')).toBe('orphan');
        });
    });

    // -------------------------------------------------------------------
    // Blockquote
    // -------------------------------------------------------------------

    describe('blockquote', () => {
        it('preserves blockquote tags', () => {
            const result = htmlToTelegramHtml('<blockquote>quoted text</blockquote>');
            expect(result).toContain('<blockquote>quoted text</blockquote>');
        });

        it('preserves expandable blockquotes', () => {
            const html = '<blockquote expandable>long quote</blockquote>';
            const result = htmlToTelegramHtml(html);
            expect(result).toContain('<blockquote expandable>long quote</blockquote>');
        });
    });

    // -------------------------------------------------------------------
    // Lists
    // -------------------------------------------------------------------

    describe('lists', () => {
        it('converts unordered list to bullet points', () => {
            const html = '<ul><li>Alpha</li><li>Beta</li></ul>';
            const result = htmlToTelegramHtml(html);
            expect(result).toContain('• Alpha');
            expect(result).toContain('• Beta');
        });

        it('converts ordered list to numbered items', () => {
            const html = '<ol><li>First</li><li>Second</li><li>Third</li></ol>';
            const result = htmlToTelegramHtml(html);
            expect(result).toContain('1. First');
            expect(result).toContain('2. Second');
            expect(result).toContain('3. Third');
        });

        it('handles list items with inline formatting', () => {
            const html = '<ul><li><b>bold</b> item</li></ul>';
            const result = htmlToTelegramHtml(html);
            expect(result).toContain('• <b>bold</b> item');
        });
    });

    // -------------------------------------------------------------------
    // Block elements
    // -------------------------------------------------------------------

    describe('block elements', () => {
        it('converts p tags to double newlines', () => {
            const html = '<p>First paragraph</p><p>Second paragraph</p>';
            const result = htmlToTelegramHtml(html);
            expect(result).toContain('First paragraph');
            expect(result).toContain('Second paragraph');
            expect(result).toMatch(/First paragraph\n\n/);
        });

        it('converts br to newline', () => {
            expect(htmlToTelegramHtml('line1<br>line2')).toBe('line1\nline2');
            expect(htmlToTelegramHtml('line1<br/>line2')).toBe('line1\nline2');
        });

        it('converts hr to separator', () => {
            const result = htmlToTelegramHtml('above<hr>below');
            expect(result).toContain('──────────');
        });
    });

    // -------------------------------------------------------------------
    // AG-specific elements
    // -------------------------------------------------------------------

    describe('AG-specific elements', () => {
        it('converts context-scope-mention spans to inline code', () => {
            const html = '<span class="context-scope-mention">config.ts</span>';
            expect(htmlToTelegramHtml(html)).toBe('<code>config.ts</code>');
        });

        it('restores file path from title attribute', () => {
            const html = '<div title="src/bot/index.ts">:54</div>';
            const result = htmlToTelegramHtml(html);
            expect(result).toContain('src/bot/index.ts');
            expect(result).toContain(':54');
            expect(result).toContain('<code>');
        });

        it('ignores title attribute that does not look like a file path', () => {
            const html = '<div title="some tooltip">content</div>';
            const result = htmlToTelegramHtml(html);
            expect(result).toContain('content');
            expect(result).not.toContain('some tooltip');
        });

        it('removes style tags completely', () => {
            const html = '<style>.foo { color: red; }</style><p>visible</p>';
            const result = htmlToTelegramHtml(html);
            expect(result).toContain('visible');
            expect(result).not.toContain('.foo');
            expect(result).not.toContain('color');
        });
    });

    // -------------------------------------------------------------------
    // Tables
    // -------------------------------------------------------------------

    describe('tables', () => {
        it('converts simple table to pre monospace', () => {
            const html = [
                '<table>',
                '<tr><th>Name</th><th>Value</th></tr>',
                '<tr><td>foo</td><td>bar</td></tr>',
                '</table>',
            ].join('');
            const result = htmlToTelegramHtml(html);
            expect(result).toContain('<pre>');
            expect(result).toContain('Name');
            expect(result).toContain('foo');
            expect(result).toContain('</pre>');
        });
    });

    // -------------------------------------------------------------------
    // Mixed content
    // -------------------------------------------------------------------

    describe('mixed content', () => {
        it('handles complex HTML with multiple element types', () => {
            const html = [
                '<h2>Summary</h2>',
                '<p>Here is the <strong>result</strong>:</p>',
                '<ol><li>Item one</li><li>Item two</li></ol>',
                '<p>See <code>utils.ts</code> for details.</p>',
            ].join('');

            const result = htmlToTelegramHtml(html);
            expect(result).toContain('<b>Summary</b>');
            expect(result).toContain('<b>result</b>');
            expect(result).toContain('1. Item one');
            expect(result).toContain('2. Item two');
            expect(result).toContain('<code>utils.ts</code>');
        });
    });

    // -------------------------------------------------------------------
    // Strip unknown tags
    // -------------------------------------------------------------------

    describe('strips unknown tags', () => {
        it('removes unrecognized tags while keeping text', () => {
            const html = '<section><article>Content here</article></section>';
            expect(htmlToTelegramHtml(html)).toBe('Content here');
        });
    });

    // -------------------------------------------------------------------
    // Spoiler
    // -------------------------------------------------------------------

    describe('spoiler', () => {
        it('preserves tg-spoiler tags', () => {
            expect(htmlToTelegramHtml('<tg-spoiler>hidden</tg-spoiler>')).toBe(
                '<tg-spoiler>hidden</tg-spoiler>',
            );
        });

        it('converts span.tg-spoiler to tg-spoiler', () => {
            const html = '<span class="tg-spoiler">secret</span>';
            expect(htmlToTelegramHtml(html)).toBe('<tg-spoiler>secret</tg-spoiler>');
        });
    });

    // -------------------------------------------------------------------
    // Excessive newlines
    // -------------------------------------------------------------------

    describe('whitespace cleanup', () => {
        it('collapses 3+ newlines to double newline', () => {
            const html = '<p>A</p><p></p><p></p><p>B</p>';
            const result = htmlToTelegramHtml(html);
            expect(result).not.toMatch(/\n{3,}/);
        });
    });
});

// ---------------------------------------------------------------------------
// escapeHtml utility
// ---------------------------------------------------------------------------

describe('escapeHtml', () => {
    it('escapes <, >, &', () => {
        expect(escapeHtml('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
    });

    it('returns empty string for empty input', () => {
        expect(escapeHtml('')).toBe('');
    });
});
