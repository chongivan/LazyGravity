"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSafePath = void 0;
const path_1 = __importDefault(require("path"));
const resolveSafePath = (inputPath, baseDir) => {
    const resolvedPath = path_1.default.resolve(baseDir, inputPath);
    const normalizedBaseDir = path_1.default.resolve(baseDir);
    const relative = path_1.default.relative(normalizedBaseDir, resolvedPath);
    if (relative && (relative.startsWith('..' + path_1.default.sep) || relative === '..')) {
        throw new Error('Path traversal detected');
    }
    if (path_1.default.isAbsolute(relative)) {
        throw new Error('Path traversal detected');
    }
    return resolvedPath;
};
exports.resolveSafePath = resolveSafePath;
