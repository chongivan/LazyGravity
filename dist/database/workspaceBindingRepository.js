"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceBindingRepository = void 0;
/**
 * Repository for persisting Discord channel to workspace directory bindings in SQLite.
 * Only one workspace can be bound per channel (UNIQUE constraint).
 */
class WorkspaceBindingRepository {
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
            CREATE TABLE IF NOT EXISTS workspace_bindings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                channel_id TEXT NOT NULL UNIQUE,
                workspace_path TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `);
    }
    /**
     * Create a new binding
     */
    create(input) {
        const stmt = this.db.prepare(`
            INSERT INTO workspace_bindings (channel_id, workspace_path, guild_id)
            VALUES (?, ?, ?)
        `);
        const result = stmt.run(input.channelId, input.workspacePath, input.guildId);
        return {
            id: result.lastInsertRowid,
            channelId: input.channelId,
            workspacePath: input.workspacePath,
            guildId: input.guildId,
        };
    }
    /**
     * Find binding by channel ID
     */
    findByChannelId(channelId) {
        const row = this.db.prepare('SELECT * FROM workspace_bindings WHERE channel_id = ?').get(channelId);
        if (!row)
            return undefined;
        return this.mapRow(row);
    }
    /**
     * Find bindings by workspace path and guild ID
     * Used to prevent duplicate workspace creation
     */
    findByWorkspacePathAndGuildId(workspacePath, guildId) {
        const rows = this.db.prepare('SELECT * FROM workspace_bindings WHERE workspace_path = ? AND guild_id = ? ORDER BY id ASC').all(workspacePath, guildId);
        return rows.map(this.mapRow);
    }
    /**
     * Find all bindings by guild ID
     */
    findByGuildId(guildId) {
        const rows = this.db.prepare('SELECT * FROM workspace_bindings WHERE guild_id = ? ORDER BY id ASC').all(guildId);
        return rows.map(this.mapRow);
    }
    /**
     * Get all bindings
     */
    findAll() {
        const rows = this.db.prepare('SELECT * FROM workspace_bindings ORDER BY id ASC').all();
        return rows.map(this.mapRow);
    }
    /**
     * Delete binding by channel ID
     */
    deleteByChannelId(channelId) {
        const result = this.db.prepare('DELETE FROM workspace_bindings WHERE channel_id = ?').run(channelId);
        return result.changes > 0;
    }
    /**
     * Create or update a channel binding (upsert)
     */
    upsert(input) {
        const stmt = this.db.prepare(`
            INSERT INTO workspace_bindings (channel_id, workspace_path, guild_id)
            VALUES (?, ?, ?)
            ON CONFLICT(channel_id) DO UPDATE SET
                workspace_path = excluded.workspace_path,
                guild_id = excluded.guild_id
        `);
        stmt.run(input.channelId, input.workspacePath, input.guildId);
        return this.findByChannelId(input.channelId);
    }
    /**
     * Map a DB row to WorkspaceBindingRecord
     */
    mapRow(row) {
        return {
            id: row.id,
            channelId: row.channel_id,
            workspacePath: row.workspace_path,
            guildId: row.guild_id,
            createdAt: row.created_at,
        };
    }
}
exports.WorkspaceBindingRepository = WorkspaceBindingRepository;
