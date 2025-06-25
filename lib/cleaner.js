import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { findTrackedSensitiveFiles } from './detector.js';

/**
 * Check if current directory is a git repository
 */
function isGitRepository(projectPath = '.') {
    try {
        execSync('git rev-parse --git-dir', {
            cwd: projectPath,
            stdio: 'ignore'
        });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Check if git working directory is clean (no uncommitted changes)
 */
function isWorkingDirectoryClean(projectPath = '.') {
    try {
        const status = execSync('git status --porcelain', {
            cwd: projectPath,
            encoding: 'utf8'
        });
        return status.trim() === '';
    } catch (error) {
        return false;
    }
}

/**
 * Get git status for specific files
 */
function getFileStatus(files, projectPath = '.') {
    const statusMap = new Map();

    try {
        const status = execSync('git status --porcelain', {
            cwd: projectPath,
            encoding: 'utf8'
        });

        const statusLines = status.split('\n').filter(Boolean);

        statusLines.forEach(line => {
            const statusCode = line.slice(0, 2);
            const filename = line.slice(3);

            if (files.includes(filename)) {
                statusMap.set(filename, {
                    staged: statusCode[0] !== ' ' && statusCode[0] !== '?',
                    unstaged: statusCode[1] !== ' ' && statusCode[1] !== '?',
                    untracked: statusCode === '??'
                });
            }
        });

        // Files not in status are clean/tracked
        files.forEach(file => {
            if (!statusMap.has(file)) {
                statusMap.set(file, { staged: false, unstaged: false, untracked: false });
            }
        });

    } catch (error) {
        // If git status fails, assume files are problematic
        files.forEach(file => {
            statusMap.set(file, { staged: false, unstaged: true, untracked: false });
        });
    }

    return statusMap;
}

/**
 * Remove a single file from git tracking
 */
async function removeFileFromTracking(filePath, projectPath = '.') {
    return new Promise((resolve, reject) => {
        const gitProcess = spawn('git', ['rm', '--cached', filePath], {
            cwd: projectPath,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        gitProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        gitProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        gitProcess.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, stdout, stderr });
            } else {
                resolve({
                    success: false,
                    error: stderr || `git rm --cached failed with code ${code}`,
                    stdout,
                    stderr
                });
            }
        });

        gitProcess.on('error', (error) => {
            reject(new Error(`Failed to spawn git process: ${error.message}`));
        });
    });
}

/**
 * Remove multiple files from git tracking with progress feedback
 */
export async function removeTrackedSensitiveFiles(projectPath = '.', options = {}) {
    const { dryRun = false, force = false } = options;

    // Validate git repository
    if (!isGitRepository(projectPath)) {
        throw new Error('Not a git repository');
    }

    // Find tracked sensitive files
    const trackedFiles = findTrackedSensitiveFiles(projectPath);

    if (trackedFiles.length === 0) {
        return {
            success: true,
            removed: [],
            skipped: [],
            failed: [],
            message: 'No tracked sensitive files found'
        };
    }

    // Check git status for each file
    const fileStatuses = getFileStatus(trackedFiles, projectPath);

    const results = {
        success: true,
        removed: [],
        skipped: [],
        failed: [],
        warnings: []
    };

    // Categorize files by their status
    const filesToProcess = [];
    const problematicFiles = [];

    trackedFiles.forEach(file => {
        const status = fileStatuses.get(file);

        if (status.staged && !force) {
            problematicFiles.push({
                file,
                reason: 'has staged changes',
                suggestion: 'commit changes first or use --force'
            });
        } else if (status.unstaged && !force) {
            problematicFiles.push({
                file,
                reason: 'has unstaged changes',
                suggestion: 'commit changes first or use --force'
            });
        } else {
            filesToProcess.push(file);
        }
    });

    // Report problematic files
    if (problematicFiles.length > 0) {
        results.warnings.push(`${problematicFiles.length} files have uncommitted changes`);

        problematicFiles.forEach(({ file, reason, suggestion }) => {
            results.skipped.push({
                file,
                reason: `${reason} - ${suggestion}`
            });
        });

        if (!force) {
            results.warnings.push('Use --force to remove files with uncommitted changes');
        }
    }

    // Process files for removal
    if (dryRun) {
        results.message = `Dry run: would remove ${filesToProcess.length} file(s)`;
        filesToProcess.forEach(file => {
            results.removed.push({ file, status: 'would remove' });
        });

        return results;
    }

    // Actually remove files
    for (const file of filesToProcess) {
        try {
            const result = await removeFileFromTracking(file, projectPath);

            if (result.success) {
                results.removed.push({
                    file,
                    status: 'removed from tracking'
                });
            } else {
                results.failed.push({
                    file,
                    error: result.error
                });
                results.success = false;
            }
        } catch (error) {
            results.failed.push({
                file,
                error: error.message
            });
            results.success = false;
        }
    }

    return results;
}

/**
 * Preview what files would be removed without actually removing them
 */
export function previewCleanup(projectPath = '.') {
    if (!isGitRepository(projectPath)) {
        return {
            error: 'Not a git repository'
        };
    }

    const trackedFiles = findTrackedSensitiveFiles(projectPath);

    if (trackedFiles.length === 0) {
        return {
            files: [],
            message: 'No tracked sensitive files found'
        };
    }

    const fileStatuses = getFileStatus(trackedFiles, projectPath);
    const preview = [];

    trackedFiles.forEach(file => {
        const status = fileStatuses.get(file);
        let action = 'remove from tracking';
        let warning = null;

        if (status.staged || status.unstaged) {
            warning = 'has uncommitted changes';
            action = 'skip (use --force to override)';
        }

        preview.push({
            file,
            action,
            warning,
            status: {
                staged: status.staged,
                unstaged: status.unstaged,
                untracked: status.untracked
            }
        });
    });

    return {
        files: preview,
        totalFiles: trackedFiles.length,
        canRemove: preview.filter(f => !f.warning).length,
        hasWarnings: preview.some(f => f.warning)
    };
}

/**
 * Validate if cleanup is safe to perform
 */
export function validateCleanupSafety(projectPath = '.') {
    const issues = [];
    const warnings = [];

    if (!isGitRepository(projectPath)) {
        issues.push('Not a git repository');
        return { safe: false, issues, warnings };
    }

    const trackedFiles = findTrackedSensitiveFiles(projectPath);

    if (trackedFiles.length === 0) {
        return {
            safe: true,
            issues,
            warnings,
            message: 'No sensitive files to clean up'
        };
    }

    const fileStatuses = getFileStatus(trackedFiles, projectPath);

    // Check for uncommitted changes
    let hasUncommittedChanges = false;
    trackedFiles.forEach(file => {
        const status = fileStatuses.get(file);
        if (status.staged || status.unstaged) {
            hasUncommittedChanges = true;
            warnings.push(`${file} has uncommitted changes`);
        }
    });

    if (hasUncommittedChanges) {
        warnings.push('Consider committing changes before cleanup');
    }

    // Check if files actually exist
    trackedFiles.forEach(file => {
        const fullPath = path.join(projectPath, file);
        if (!fs.existsSync(fullPath)) {
            warnings.push(`${file} is tracked but doesn't exist on disk`);
        }
    });

    return {
        safe: issues.length === 0,
        issues,
        warnings,
        filesFound: trackedFiles.length
    };
}