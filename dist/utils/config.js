"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveResponseDeliveryMode = resolveResponseDeliveryMode;
exports.loadConfig = loadConfig;
const configLoader_1 = require("./configLoader");
/**
 * Response delivery is fixed to 'stream'.
 * Env vars are read for backward compatibility but the value is always 'stream'.
 */
function resolveResponseDeliveryMode() {
    return 'stream';
}
/**
 * Load application config.
 * Delegates to ConfigLoader which resolves:
 *   env vars  >  ~/.lazy-gravity/config.json  >  .env  >  defaults
 */
function loadConfig() {
    return configLoader_1.ConfigLoader.load();
}
