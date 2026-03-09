"use strict";
/**
 * Immutable builder functions for RichContent.
 *
 * All functions return a new object — never mutate the input.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRichContent = createRichContent;
exports.withTitle = withTitle;
exports.withDescription = withDescription;
exports.withColor = withColor;
exports.addField = addField;
exports.withFields = withFields;
exports.withFooter = withFooter;
exports.withTimestamp = withTimestamp;
exports.withThumbnail = withThumbnail;
exports.withImage = withImage;
exports.pipe = pipe;
/** Create an empty RichContent. */
function createRichContent() {
    return {};
}
/** Set the title. */
function withTitle(rc, title) {
    return { ...rc, title };
}
/** Set the description. */
function withDescription(rc, description) {
    return { ...rc, description };
}
/** Set the color (numeric, e.g. 0x5865F2). */
function withColor(rc, color) {
    return { ...rc, color };
}
/** Add a field. Existing fields are preserved. */
function addField(rc, name, value, inline) {
    const field = { name, value, inline };
    const fields = rc.fields ? [...rc.fields, field] : [field];
    return { ...rc, fields };
}
/** Replace all fields at once. */
function withFields(rc, fields) {
    return { ...rc, fields: fields.map((field) => ({ ...field })) };
}
/** Set the footer text. */
function withFooter(rc, footer) {
    return { ...rc, footer };
}
/** Set the timestamp. */
function withTimestamp(rc, timestamp) {
    return { ...rc, timestamp: timestamp ?? new Date() };
}
/** Set the thumbnail URL. */
function withThumbnail(rc, thumbnailUrl) {
    return { ...rc, thumbnailUrl };
}
/** Set the image URL. */
function withImage(rc, imageUrl) {
    return { ...rc, imageUrl };
}
// ---------------------------------------------------------------------------
// Convenience: fluent-style chain helper
// ---------------------------------------------------------------------------
/**
 * Apply a sequence of transforms to a RichContent.
 * Each transform is a function `(rc: RichContent) => RichContent`.
 * Usage:
 *   pipe(
 *     createRichContent(),
 *     (rc) => withTitle(rc, 'Hello'),
 *     (rc) => withColor(rc, 0x00FF00),
 *   )
 */
function pipe(initial, ...transforms) {
    return transforms.reduce((acc, fn) => fn(acc), initial);
}
