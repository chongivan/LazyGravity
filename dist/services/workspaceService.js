"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceService = void 0;
const fs_1 = __importDefault(require("fs"));
const sanitize_1 = require("../middleware/sanitize");
/**
 * Service for workspace filesystem operations and path validation.
 * Manages directories under WORKSPACE_BASE_DIR.
 */
class WorkspaceService {
    baseDir;
    constructor(baseDir) {
        this.baseDir = baseDir;
    }
    /**
     * Ensure the base directory exists, creating it if necessary
     */
    ensureBaseDir() {
        if (!fs_1.default.existsSync(this.baseDir)) {
            fs_1.default.mkdirSync(this.baseDir, { recursive: true });
        }
    }
    /**
     * Return a list of subdirectories in the base directory
     */
    scanWorkspaces() {
        this.ensureBaseDir();
        const entries = fs_1.default.readdirSync(this.baseDir, { withFileTypes: true });
        return entries
            .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
            .map((entry) => entry.name)
            .sort();
    }
    /**
     * Validate a relative path and return a safe absolute path
     * @throws On path traversal detection
     */
    validatePath(relativePath) {
        return (0, sanitize_1.resolveSafePath)(relativePath, this.baseDir);
    }
    /**
     * Get the base directory path
     */
    getBaseDir() {
        return this.baseDir;
    }
    /**
     * Return the absolute path of the specified workspace
     */
    getWorkspacePath(workspaceName) {
        return this.validatePath(workspaceName);
    }
    /**
     * Check if the specified workspace exists
     */
    exists(workspaceName) {
        const fullPath = this.validatePath(workspaceName);
        return fs_1.default.existsSync(fullPath) && fs_1.default.statSync(fullPath).isDirectory();
    }
}
exports.WorkspaceService = WorkspaceService;
