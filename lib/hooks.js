// lib/hooks.js
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Check if git hooks are installed
 */
export function checkHookInstallation(targetDir = '.') {
    try {
        const gitDir = path.join(targetDir, '.git');
        const hooksDir = path.join(gitDir, 'hooks');
        const preCommitPath = path.join(hooksDir, 'pre-commit');
        
        if (!fs.existsSync(gitDir)) {
            return { installed: false, reason: 'Not a git repository' };
        }
        
        if (!fs.existsSync(preCommitPath)) {
            return { installed: false, reason: 'No pre-commit hook found' };
        }
        
        const hookContent = fs.readFileSync(preCommitPath, 'utf8');
        const isSecureCommitHook = hookContent.includes('Secure Project') || 
                                   hookContent.includes('secure-commit');
        
        return {
            installed: isSecureCommitHook,
            hookPath: preCommitPath,
            reason: isSecureCommitHook ? 'Installed' : 'Different hook exists'
        };
    } catch (error) {
        return { installed: false, reason: `Error: ${error.message}` };
    }
}

/**
 * Install git pre-commit hooks
 */
export function installHooks(targetDir = '.', options = {}) {
    const { force = false } = options;
    
    try {
        const gitDir = path.join(targetDir, '.git');
        const hooksDir = path.join(gitDir, 'hooks');
        const preCommitPath = path.join(hooksDir, 'pre-commit');
        
        // Verify git repository
        if (!fs.existsSync(gitDir)) {
            throw new Error('Not a git repository. Run "git init" first.');
        }
        
        // Ensure hooks directory exists
        fs.ensureDirSync(hooksDir);
        
        // Check if hook already exists
        if (fs.existsSync(preCommitPath) && !force) {
            const existingContent = fs.readFileSync(preCommitPath, 'utf8');
            if (existingContent.includes('Secure Project') || existingContent.includes('secure-commit')) {
                return {
                    success: true,
                    message: 'Hook already installed',
                    hookPath: preCommitPath
                };
            } else {
                throw new Error('A different pre-commit hook already exists. Use --force to overwrite.');
            }
        }
        
        // Read template hook
        const templatePath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'templates', 'pre-commit');
        const hookTemplate = fs.readFileSync(templatePath, 'utf8');
        
        // Write the hook
        fs.writeFileSync(preCommitPath, hookTemplate);
        
        // Make executable
        fs.chmodSync(preCommitPath, '755');
        
        return {
            success: true,
            message: 'Hook installed successfully',
            hookPath: preCommitPath
        };
        
    } catch (error) {
        throw new Error(`Failed to install hooks: ${error.message}`);
    }
}

/**
 * Uninstall git pre-commit hooks
 */
export function uninstallHooks(targetDir = '.') {
    try {
        const gitDir = path.join(targetDir, '.git');
        const hooksDir = path.join(gitDir, 'hooks');
        const preCommitPath = path.join(hooksDir, 'pre-commit');
        
        if (!fs.existsSync(gitDir)) {
            throw new Error('Not a git repository');
        }
        
        if (!fs.existsSync(preCommitPath)) {
            return {
                success: true,
                message: 'No pre-commit hook found to remove'
            };
        }
        
        // Verify it's our hook before removing
        const hookContent = fs.readFileSync(preCommitPath, 'utf8');
        const isOurHook = hookContent.includes('Secure Project') || 
                         hookContent.includes('secure-commit');
        
        if (!isOurHook) {
            throw new Error('Pre-commit hook exists but was not installed by secure-commit. Remove manually if needed.');
        }
        
        // Remove the hook
        fs.removeSync(preCommitPath);
        
        return {
            success: true,
            message: 'Hook removed successfully'
        };
        
    } catch (error) {
        throw new Error(`Failed to uninstall hooks: ${error.message}`);
    }
}

/**
 * Test if git hooks are working
 */
export function testHooks(targetDir = '.') {
    try {
        // Check if hooks are installed
        const status = checkHookInstallation(targetDir);
        if (!status.installed) {
            return {
                success: false,
                message: 'Hooks not installed'
            };
        }
        
        // Try to run the hook directly
        const hookPath = status.hookPath;
        execSync(`bash "${hookPath}"`, { 
            cwd: targetDir,
            stdio: 'pipe'
        });
        
        return {
            success: true,
            message: 'Hook executed successfully'
        };
        
    } catch (error) {
        return {
            success: false,
            message: `Hook test failed: ${error.message}`
        };
    }
}