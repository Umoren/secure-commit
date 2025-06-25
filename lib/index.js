// lib/index.js
// Main entry point for secure-commit library

export { detectFramework, scanDirectory, findTrackedSensitiveFiles } from './detector.js';
export { updateGitignore, previewGitignoreChanges, validateGitignore } from './gitignore.js';
export { removeTrackedSensitiveFiles, previewCleanup, validateCleanupSafety } from './cleaner.js';
export { installHooks, uninstallHooks, checkHookInstallation, testHooks } from './hooks.js';
export { patterns } from './patterns.js';