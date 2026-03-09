"use strict";
/**
 * Platform abstraction types for multi-platform support.
 *
 * These types provide a common interface layer between Discord, Telegram,
 * and future messaging platforms. All platform-specific code should convert
 * to/from these types at the adapter boundary.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPlatformKey = toPlatformKey;
exports.fromPlatformKey = fromPlatformKey;
/** Encode a PlatformId to a "platform:id" string key. */
function toPlatformKey(pid) {
    return `${pid.platform}:${pid.id}`;
}
/** Decode a "platform:id" string key to a PlatformId. Returns null on invalid input. */
function fromPlatformKey(key) {
    const idx = key.indexOf(':');
    if (idx <= 0)
        return null;
    const platform = key.slice(0, idx);
    if (platform !== 'discord' && platform !== 'telegram')
        return null;
    const id = key.slice(idx + 1);
    if (!id)
        return null;
    return { platform: platform, id };
}
