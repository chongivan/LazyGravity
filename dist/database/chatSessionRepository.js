"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatSessionRepository = void 0;
/**
 * Repository for persisting Discord channel to chat session mapping in SQLite.
 * One session per channel (UNIQUE constraint).
 */
class ChatSessionRepository {
    db;
    constructor(db) {
        this.db = db;
        this.initialize();
    }
    initialize() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                channel_id TEXT NOT NULL UNIQUE,
                category_id TEXT NOT NULL,
                workspace_path TEXT NOT NULL,
                session_number INTEGER NOT NULL,
                display_name TEXT,
                is_renamed INTEGER NOT NULL DEFAULT 0,
                guild_id TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `);
    }
    create(input) {
        const stmt = this.db.prepare(`
            INSERT INTO chat_sessions (channel_id, category_id, workspace_path, session_number, guild_id)
            VALUES (?, ?, ?, ?, ?)
        `);
        const result = stmt.run(input.channelId, input.categoryId, input.workspacePath, input.sessionNumber, input.guildId);
        return {
            id: result.lastInsertRowid,
            channelId: input.channelId,
            categoryId: input.categoryId,
            workspacePath: input.workspacePath,
            sessionNumber: input.sessionNumber,
            displayName: null,
            isRenamed: false,
            guildId: input.guildId,
        };
    }
    findByChannelId(channelId) {
        const row = this.db.prepare('SELECT * FROM chat_sessions WHERE channel_id = ?').get(channelId);
        if (!row)
            return undefined;
        return this.mapRow(row);
    }
    findByCategoryId(categoryId) {
        const rows = this.db.prepare('SELECT * FROM chat_sessions WHERE category_id = ? ORDER BY session_number ASC').all(categoryId);
        return rows.map(this.mapRow);
    }
    /**
     * Get the next session number within a category (MAX + 1, or 1 if none)
     */
    getNextSessionNumber(categoryId) {
        const row = this.db.prepare('SELECT MAX(session_number) as max_num FROM chat_sessions WHERE category_id = ?').get(categoryId);
        return (row?.max_num ?? 0) + 1;
    }
    /**
     * Update session display name and set is_renamed to true
     */
    updateDisplayName(channelId, displayName) {
        const result = this.db.prepare('UPDATE chat_sessions SET display_name = ?, is_renamed = 1 WHERE channel_id = ?').run(displayName, channelId);
        return result.changes > 0;
    }
    /**
     * Find a session by display name within a workspace.
     * Returns the first match (most recent).
     */
    findByDisplayName(workspacePath, displayName) {
        const row = this.db.prepare('SELECT * FROM chat_sessions WHERE workspace_path = ? AND display_name = ? ORDER BY id DESC LIMIT 1').get(workspacePath, displayName);
        if (!row)
            return undefined;
        return this.mapRow(row);
    }
    deleteByChannelId(channelId) {
        const result = this.db.prepare('DELETE FROM chat_sessions WHERE channel_id = ?').run(channelId);
        return result.changes > 0;
    }
    mapRow(row) {
        return {
            id: row.id,
            channelId: row.channel_id,
            categoryId: row.category_id,
            workspacePath: row.workspace_path,
            sessionNumber: row.session_number,
            displayName: row.display_name,
            isRenamed: row.is_renamed === 1,
            guildId: row.guild_id,
            createdAt: row.created_at,
        };
    }
}
exports.ChatSessionRepository = ChatSessionRepository;
