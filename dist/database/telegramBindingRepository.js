"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramBindingRepository = void 0;
/**
 * Repository for persisting Telegram chat to workspace directory bindings in SQLite.
 * Only one workspace can be bound per chat (UNIQUE constraint).
 */
class TelegramBindingRepository {
    db;
    constructor(db) {
        this.db = db;
        this.initialize();
    }
    /**
     * Initialize table (create if not exists)
     */
    initialize() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS telegram_bindings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL UNIQUE,
                workspace_path TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `);
    }
    /**
     * Create a new binding
     */
    create(input) {
        const stmt = this.db.prepare(`
            INSERT INTO telegram_bindings (chat_id, workspace_path)
            VALUES (?, ?)
        `);
        const result = stmt.run(input.chatId, input.workspacePath);
        return {
            id: result.lastInsertRowid,
            chatId: input.chatId,
            workspacePath: input.workspacePath,
        };
    }
    /**
     * Find binding by chat ID
     */
    findByChatId(chatId) {
        const row = this.db.prepare('SELECT * FROM telegram_bindings WHERE chat_id = ?').get(chatId);
        if (!row)
            return undefined;
        return this.mapRow(row);
    }
    /**
     * Find bindings by workspace path
     */
    findByWorkspacePath(workspacePath) {
        const rows = this.db.prepare('SELECT * FROM telegram_bindings WHERE workspace_path = ? ORDER BY id ASC').all(workspacePath);
        return rows.map(this.mapRow);
    }
    /**
     * Get all bindings
     */
    findAll() {
        const rows = this.db.prepare('SELECT * FROM telegram_bindings ORDER BY id ASC').all();
        return rows.map(this.mapRow);
    }
    /**
     * Delete binding by chat ID
     */
    deleteByChatId(chatId) {
        const result = this.db.prepare('DELETE FROM telegram_bindings WHERE chat_id = ?').run(chatId);
        return result.changes > 0;
    }
    /**
     * Create or update a chat binding (upsert)
     */
    upsert(input) {
        const stmt = this.db.prepare(`
            INSERT INTO telegram_bindings (chat_id, workspace_path)
            VALUES (?, ?)
            ON CONFLICT(chat_id) DO UPDATE SET
                workspace_path = excluded.workspace_path
        `);
        stmt.run(input.chatId, input.workspacePath);
        return this.findByChatId(input.chatId);
    }
    /**
     * Map a DB row to TelegramBindingRecord
     */
    mapRow(row) {
        return {
            id: row.id,
            chatId: row.chat_id,
            workspacePath: row.workspace_path,
            createdAt: row.created_at,
        };
    }
}
exports.TelegramBindingRepository = TelegramBindingRepository;
