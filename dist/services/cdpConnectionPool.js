"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdpConnectionPool = void 0;
const logger_1 = require("../utils/logger");
const pathUtils_1 = require("../utils/pathUtils");
const cdpService_1 = require("./cdpService");
/**
 * Pool that manages independent CdpService instances per workspace.
 *
 * Each workspace owns its own WebSocket / contexts / pendingCalls, so
 * switching to workspace B while workspace A's ResponseMonitor is polling
 * does not destroy A's WebSocket.
 */
class CdpConnectionPool {
    connections = new Map();
    approvalDetectors = new Map();
    errorPopupDetectors = new Map();
    planningDetectors = new Map();
    runCommandDetectors = new Map();
    userMessageDetectors = new Map();
    connectingPromises = new Map();
    cdpOptions;
    constructor(cdpOptions = {}) {
        this.cdpOptions = cdpOptions;
    }
    /**
     * Get a CdpService for the given workspace path.
     * Creates a new connection and caches it if not already connected.
     * Prevents concurrent connections via Promise locking.
     *
     * @param workspacePath Full path of the workspace
     * @returns Connected CdpService
     */
    async getOrConnect(workspacePath) {
        const projectName = this.extractProjectName(workspacePath);
        // Return existing connection if available
        const existing = this.connections.get(projectName);
        if (existing && existing.isConnected()) {
            // Re-validate that the still-open window is actually bound to this workspace.
            await existing.discoverAndConnectForWorkspace(workspacePath);
            return existing;
        }
        // Wait for the pending connection promise if one exists (prevents concurrent connections)
        const pending = this.connectingPromises.get(projectName);
        if (pending) {
            return pending;
        }
        // Start a new connection
        const connectPromise = this.createAndConnect(workspacePath, projectName);
        this.connectingPromises.set(projectName, connectPromise);
        try {
            const cdp = await connectPromise;
            return cdp;
        }
        finally {
            this.connectingPromises.delete(projectName);
        }
    }
    /**
     * Get a connected CdpService (read-only).
     * Returns null if not connected.
     */
    getConnected(projectName) {
        const cdp = this.connections.get(projectName);
        if (cdp && cdp.isConnected()) {
            return cdp;
        }
        return null;
    }
    /**
     * Disconnect the specified workspace.
     */
    disconnectWorkspace(projectName) {
        const cdp = this.connections.get(projectName);
        if (cdp) {
            cdp.disconnect().catch((err) => {
                logger_1.logger.error(`[CdpConnectionPool] Error while disconnecting ${projectName}:`, err);
            });
            this.connections.delete(projectName);
        }
        const detector = this.approvalDetectors.get(projectName);
        if (detector) {
            detector.stop();
            this.approvalDetectors.delete(projectName);
        }
        const errorPopupDetector = this.errorPopupDetectors.get(projectName);
        if (errorPopupDetector) {
            errorPopupDetector.stop();
            this.errorPopupDetectors.delete(projectName);
        }
        const planningDetector = this.planningDetectors.get(projectName);
        if (planningDetector) {
            planningDetector.stop();
            this.planningDetectors.delete(projectName);
        }
        const runCmdDetector = this.runCommandDetectors.get(projectName);
        if (runCmdDetector) {
            runCmdDetector.stop();
            this.runCommandDetectors.delete(projectName);
        }
        const userMsgDetector = this.userMessageDetectors.get(projectName);
        if (userMsgDetector) {
            userMsgDetector.stop();
            this.userMessageDetectors.delete(projectName);
        }
    }
    /**
     * Disconnect all workspace connections.
     */
    disconnectAll() {
        for (const projectName of [...this.connections.keys()]) {
            this.disconnectWorkspace(projectName);
        }
    }
    /**
     * Register an approval detector for a workspace.
     */
    registerApprovalDetector(projectName, detector) {
        // Stop existing detector
        const existing = this.approvalDetectors.get(projectName);
        if (existing && existing.isActive()) {
            existing.stop();
        }
        this.approvalDetectors.set(projectName, detector);
    }
    /**
     * Get the approval detector for a workspace.
     */
    getApprovalDetector(projectName) {
        return this.approvalDetectors.get(projectName);
    }
    /**
     * Register an error popup detector for a workspace.
     */
    registerErrorPopupDetector(projectName, detector) {
        // Stop existing detector
        const existing = this.errorPopupDetectors.get(projectName);
        if (existing && existing.isActive()) {
            existing.stop();
        }
        this.errorPopupDetectors.set(projectName, detector);
    }
    /**
     * Get the error popup detector for a workspace.
     */
    getErrorPopupDetector(projectName) {
        return this.errorPopupDetectors.get(projectName);
    }
    /**
     * Register a planning detector for a workspace.
     */
    registerPlanningDetector(projectName, detector) {
        // Stop existing detector
        const existing = this.planningDetectors.get(projectName);
        if (existing && existing.isActive()) {
            existing.stop();
        }
        this.planningDetectors.set(projectName, detector);
    }
    /**
     * Get the planning detector for a workspace.
     */
    getPlanningDetector(projectName) {
        return this.planningDetectors.get(projectName);
    }
    /**
     * Register a run command detector for a workspace.
     */
    registerRunCommandDetector(projectName, detector) {
        const existing = this.runCommandDetectors.get(projectName);
        if (existing && existing.isActive()) {
            existing.stop();
        }
        this.runCommandDetectors.set(projectName, detector);
    }
    /**
     * Get the run command detector for a workspace.
     */
    getRunCommandDetector(projectName) {
        return this.runCommandDetectors.get(projectName);
    }
    /**
     * Register a user message detector for a workspace.
     */
    registerUserMessageDetector(projectName, detector) {
        const existing = this.userMessageDetectors.get(projectName);
        if (existing && existing.isActive()) {
            existing.stop();
        }
        this.userMessageDetectors.set(projectName, detector);
    }
    /**
     * Get the user message detector for a workspace.
     */
    getUserMessageDetector(projectName) {
        return this.userMessageDetectors.get(projectName);
    }
    /**
     * Return a list of workspace names with active connections.
     */
    getActiveWorkspaceNames() {
        const active = [];
        for (const [name, cdp] of this.connections) {
            if (cdp.isConnected()) {
                active.push(name);
            }
        }
        return active;
    }
    /**
     * Extract the project name from a workspace path.
     */
    extractProjectName(workspacePath) {
        return (0, pathUtils_1.extractProjectNameFromPath)(workspacePath) || workspacePath;
    }
    /**
     * Create a new CdpService and connect to the workspace.
     */
    async createAndConnect(workspacePath, projectName) {
        // Disconnect old connection if exists
        const old = this.connections.get(projectName);
        if (old) {
            await old.disconnect().catch(() => { });
            this.connections.delete(projectName);
        }
        const cdp = new cdpService_1.CdpService(this.cdpOptions);
        // Auto-cleanup on disconnect
        cdp.on('disconnected', () => {
            logger_1.logger.error(`[CdpConnectionPool] Workspace "${projectName}" disconnected`);
            // Only remove from Map when reconnection fails
            // (CdpService attempts reconnection internally, so we don't remove here)
        });
        cdp.on('reconnectFailed', () => {
            logger_1.logger.error(`[CdpConnectionPool] Reconnection failed for workspace "${projectName}". Removing from pool`);
            this.connections.delete(projectName);
            const detector = this.approvalDetectors.get(projectName);
            if (detector) {
                detector.stop();
                this.approvalDetectors.delete(projectName);
            }
            const errorDetector = this.errorPopupDetectors.get(projectName);
            if (errorDetector) {
                errorDetector.stop();
                this.errorPopupDetectors.delete(projectName);
            }
            const planDetector = this.planningDetectors.get(projectName);
            if (planDetector) {
                planDetector.stop();
                this.planningDetectors.delete(projectName);
            }
            const runCmdDetector = this.runCommandDetectors.get(projectName);
            if (runCmdDetector) {
                runCmdDetector.stop();
                this.runCommandDetectors.delete(projectName);
            }
            const userMsgDetector = this.userMessageDetectors.get(projectName);
            if (userMsgDetector) {
                userMsgDetector.stop();
                this.userMessageDetectors.delete(projectName);
            }
        });
        // Connect to the workspace
        await cdp.discoverAndConnectForWorkspace(workspacePath);
        this.connections.set(projectName, cdp);
        return cdp;
    }
}
exports.CdpConnectionPool = CdpConnectionPool;
