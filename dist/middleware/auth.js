"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withAuth = void 0;
const withAuth = (userId, allowedUserIds, next) => {
    if (allowedUserIds.includes(userId)) {
        next();
    }
    return;
};
exports.withAuth = withAuth;
