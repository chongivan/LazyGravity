"use strict";
/**
 * Telegram wrapper functions.
 *
 * Convert Telegram-specific objects to the platform-agnostic types defined
 * in ../types.ts. Uses `TelegramBotLike` interface instead of importing
 * grammy directly, so the code compiles without grammy installed.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SELECT_CALLBACK_SEP = void 0;
exports.toTelegramPayload = toTelegramPayload;
exports.wrapTelegramUser = wrapTelegramUser;
exports.wrapTelegramChannel = wrapTelegramChannel;
exports.wrapTelegramMessage = wrapTelegramMessage;
exports.wrapTelegramCallbackQuery = wrapTelegramCallbackQuery;
exports.wrapTelegramSentMessage = wrapTelegramSentMessage;
const telegramFormatter_1 = require("./telegramFormatter");
function buttonDefToInline(btn) {
    return { text: btn.label, callback_data: btn.customId };
}
/**
 * Separator for select menu callback_data: customId + SEP + value.
 * Uses ASCII Unit Separator (0x1F) to avoid collisions with button
 * customIds that legitimately contain colons (e.g. "approve_action:proj:ch").
 */
exports.SELECT_CALLBACK_SEP = '\x1f';
function selectMenuToInlineRows(menu) {
    return menu.options.map((opt) => [
        { text: opt.label, callback_data: `${menu.customId}${exports.SELECT_CALLBACK_SEP}${opt.value}` },
    ]);
}
function componentRowsToInlineKeyboard(rows) {
    const keyboard = [];
    for (const row of rows) {
        let buttons = [];
        for (const comp of row.components) {
            if (comp.type === 'button') {
                // Telegram inline keyboards do not support disabled buttons;
                // skip them so resolved overlays don't re-show clickable buttons.
                if (comp.disabled)
                    continue;
                buttons = [...buttons, buttonDefToInline(comp)];
            }
            else if (comp.type === 'selectMenu') {
                // A select menu becomes multiple rows (one per option)
                const menuRows = selectMenuToInlineRows(comp);
                // Flush any accumulated buttons first
                if (buttons.length > 0) {
                    keyboard.push([...buttons]);
                    buttons = [];
                }
                for (const menuRow of menuRows) {
                    keyboard.push(menuRow);
                }
            }
        }
        if (buttons.length > 0) {
            keyboard.push(buttons);
        }
    }
    return keyboard;
}
// ---------------------------------------------------------------------------
// toTelegramPayload
// ---------------------------------------------------------------------------
/**
 * Convert a platform-agnostic MessagePayload to Telegram send options.
 *
 * - RichContent is rendered to HTML via richContentToHtml
 * - ComponentRow[] become inline_keyboard
 * - text + richContent are combined into one HTML message
 */
function toTelegramPayload(payload) {
    const parts = [];
    if (payload.text) {
        parts.push((0, telegramFormatter_1.markdownToTelegramHtml)(payload.text));
    }
    if (payload.richContent) {
        parts.push((0, telegramFormatter_1.richContentToHtml)(payload.richContent));
    }
    const text = parts.join('\n\n') || ' ';
    const options = {
        text,
        parse_mode: 'HTML',
    };
    if (payload.components !== undefined) {
        if (payload.components.length > 0) {
            const keyboard = componentRowsToInlineKeyboard(payload.components);
            if (keyboard.length > 0) {
                return {
                    ...options,
                    reply_markup: { inline_keyboard: keyboard },
                };
            }
        }
        // Explicitly empty components array => remove existing keyboard
        return {
            ...options,
            reply_markup: { inline_keyboard: [] },
        };
    }
    return options;
}
// ---------------------------------------------------------------------------
// Entity wrappers
// ---------------------------------------------------------------------------
/** Wrap a Telegram user object to a PlatformUser. */
function wrapTelegramUser(from) {
    const displayParts = [from.first_name];
    if (from.last_name) {
        displayParts.push(from.last_name);
    }
    return {
        id: String(from.id),
        platform: 'telegram',
        username: from.username ?? String(from.id),
        displayName: displayParts.join(' '),
        isBot: from.is_bot,
    };
}
/**
 * Try to send a file attachment via Telegram photo/document API.
 * Returns the sent message, or null if file sending is not available.
 *
 * @param toInputFile - Optional converter that wraps Buffer for the Telegram API.
 *   grammY requires Buffer wrapped in InputFile; pass `bot.toInputFile` here.
 */
async function trySendFile(api, chatId, file, caption, extraOptions, toInputFile) {
    const isImage = file.contentType?.startsWith('image/') || file.name.match(/\.(png|jpe?g|gif|webp)$/i);
    // grammY requires Buffer wrapped in InputFile; use toInputFile if available.
    const inputFile = toInputFile ? toInputFile(file.data, file.name) : file.data;
    if (isImage && api.sendPhoto) {
        return api.sendPhoto(chatId, inputFile, {
            caption,
            parse_mode: caption ? 'HTML' : undefined,
            ...extraOptions,
        });
    }
    if (api.sendDocument) {
        return api.sendDocument(chatId, inputFile, {
            caption,
            parse_mode: caption ? 'HTML' : undefined,
            ...extraOptions,
        });
    }
    return null;
}
/** Wrap a Telegram chat as a PlatformChannel. */
function wrapTelegramChannel(api, chatId, toInputFile) {
    const chatIdStr = String(chatId);
    return {
        id: chatIdStr,
        platform: 'telegram',
        name: undefined,
        async send(payload) {
            // Handle file attachments (e.g., screenshots)
            if (payload.files && payload.files.length > 0) {
                const file = payload.files[0];
                const opts = payload.text || payload.richContent
                    ? toTelegramPayload({ text: payload.text, richContent: payload.richContent })
                    : null;
                const caption = opts?.text;
                const sent = await trySendFile(api, chatId, file, caption, undefined, toInputFile);
                if (sent) {
                    return wrapTelegramSentMessage(sent, api, chatId);
                }
                // Fallback to text-only if file sending not supported
            }
            const opts = toTelegramPayload(payload);
            const { text, ...rest } = opts;
            const sent = await api.sendMessage(chatId, text, rest);
            return wrapTelegramSentMessage(sent, api, chatId);
        },
    };
}
/**
 * Build PlatformAttachment[] from a Telegram photo message.
 * Uses the largest photo size (last in the array) and constructs
 * the download URL from the bot token and file_id.
 */
function buildPhotoAttachments(photo, botToken) {
    if (photo.length === 0)
        return [];
    // Telegram sends multiple sizes; last is the largest
    const largest = photo[photo.length - 1];
    // URL is constructed later during download via getFile API.
    // Store file_id as the URL so the download utility can resolve it.
    const url = botToken
        ? `telegram-file://${largest.file_id}`
        : `telegram-file://${largest.file_id}`;
    return [{
            name: `photo-${largest.file_unique_id}.jpg`,
            contentType: 'image/jpeg',
            url,
            size: largest.file_size ?? 0,
        }];
}
/** Wrap a Telegram message as a PlatformMessage. */
function wrapTelegramMessage(msg, api, toInputFile, botToken) {
    const author = msg.from
        ? wrapTelegramUser(msg.from)
        : {
            id: '0',
            platform: 'telegram',
            username: 'unknown',
            displayName: 'Unknown',
            isBot: false,
        };
    const channel = wrapTelegramChannel(api, msg.chat.id, toInputFile);
    // Photo messages: use caption as content, build attachments from photo array
    const content = msg.text ?? msg.caption ?? '';
    const attachments = msg.photo
        ? buildPhotoAttachments(msg.photo, botToken)
        : [];
    return {
        id: String(msg.message_id),
        platform: 'telegram',
        content,
        author,
        channel,
        attachments,
        createdAt: new Date(msg.date * 1000),
        async react(emoji) {
            // Telegram Bot API 7.0+ setMessageReaction — limited to 79 emoji.
            // Silently ignore failures (unsupported emoji, old API, etc.).
            if (api.setMessageReaction) {
                await api.setMessageReaction(msg.chat.id, msg.message_id, [{ type: 'emoji', emoji }]).catch(() => { });
            }
        },
        async reply(payload) {
            // Handle file attachments (e.g., screenshots)
            if (payload.files && payload.files.length > 0) {
                const file = payload.files[0];
                const opts = payload.text || payload.richContent
                    ? toTelegramPayload({ text: payload.text, richContent: payload.richContent })
                    : null;
                const caption = opts?.text;
                const sent = await trySendFile(api, msg.chat.id, file, caption, { reply_to_message_id: msg.message_id }, toInputFile);
                if (sent) {
                    return wrapTelegramSentMessage(sent, api, msg.chat.id);
                }
                // Fallback to text-only if file sending not supported
            }
            const opts = toTelegramPayload(payload);
            const { text, ...rest } = opts;
            const sent = await api.sendMessage(msg.chat.id, text, {
                ...rest,
                reply_to_message_id: msg.message_id,
            });
            return wrapTelegramSentMessage(sent, api, msg.chat.id);
        },
    };
}
/**
 * Validate that a chatId is usable for sending messages.
 * Throws a descriptive error if the chatId is synthetic (0).
 */
function assertValidChatId(chatId) {
    if (chatId === 0 || chatId === '0') {
        throw new Error('Cannot send message: callback query has no associated chat (chatId is 0). ' +
            'Use answerCallbackQuery instead.');
    }
}
/** Wrap a Telegram callback query as a PlatformButtonInteraction. */
function wrapTelegramCallbackQuery(query, api) {
    const user = wrapTelegramUser(query.from);
    const chatId = query.message?.chat.id ?? 0;
    const channel = wrapTelegramChannel(api, chatId);
    const messageId = query.message ? String(query.message.message_id) : '0';
    const callbackQueryId = query.id;
    return {
        id: query.id,
        platform: 'telegram',
        customId: query.data ?? '',
        user,
        channel,
        messageId,
        async deferUpdate() {
            // Acknowledge the callback query to dismiss the loading indicator
            await api.answerCallbackQuery(callbackQueryId);
        },
        async reply(payload) {
            assertValidChatId(chatId);
            const opts = toTelegramPayload(payload);
            const { text, ...rest } = opts;
            await api.sendMessage(chatId, text, rest);
        },
        async update(payload) {
            if (!query.message)
                return;
            assertValidChatId(chatId);
            const opts = toTelegramPayload(payload);
            const { text, ...rest } = opts;
            await api.editMessageText(chatId, query.message.message_id, text, rest);
        },
        async editReply(payload) {
            if (!query.message)
                return;
            assertValidChatId(chatId);
            const opts = toTelegramPayload(payload);
            const { text, ...rest } = opts;
            await api.editMessageText(chatId, query.message.message_id, text, rest);
        },
        async followUp(payload) {
            assertValidChatId(chatId);
            const opts = toTelegramPayload(payload);
            const { text, ...rest } = opts;
            const sent = await api.sendMessage(chatId, text, rest);
            return wrapTelegramSentMessage(sent, api, chatId);
        },
    };
}
// ---------------------------------------------------------------------------
// Sent message wrapper
// ---------------------------------------------------------------------------
/** Wrap a Telegram API send result as a PlatformSentMessage. */
function wrapTelegramSentMessage(msg, api, chatId) {
    const msgId = String(msg.message_id ?? msg.id ?? '0');
    return {
        id: msgId,
        platform: 'telegram',
        channelId: String(chatId),
        async edit(payload) {
            const opts = toTelegramPayload(payload);
            const { text, ...rest } = opts;
            const edited = await api.editMessageText(chatId, Number(msgId), text, rest);
            return wrapTelegramSentMessage(edited, api, chatId);
        },
        async delete() {
            await api.deleteMessage(chatId, Number(msgId));
        },
    };
}
