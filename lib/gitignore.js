import fs from 'fs';
import path from 'path';
import { gitignoreTemplates } from './patterns.js';

/**
 * Represents a parsed .gitignore file with utilities for safe modification
 */
class GitignoreFile {
    constructor(filePath) {
        this.filePath = filePath;
        this.exists = fs.existsSync(filePath);
        this.lines = [];
        this.patterns = new Set();
        this.originalContent = '';

        if (this.exists) {
            this.load();
        }
    }

    /**
     * Load and parse existing .gitignore file
     */
    load() {
        try {
            this.originalContent = fs.readFileSync(this.filePath, 'utf8');
            this.lines = this.originalContent.split(/\r?\n/);

            // Extract patterns (ignore comments and empty lines)
            this.lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    this.patterns.add(this.normalizePattern(trimmed));
                }
            });
        } catch (error) {
            throw new Error(`Failed to read .gitignore: ${error.message}`);
        }
    }

    /**
     * Normalize a gitignore pattern for comparison
     * Handles trailing slashes, leading slashes, etc.
     */
    normalizePattern(pattern) {
        let normalized = pattern.trim();

        // Handle negation patterns
        if (normalized.startsWith('!')) {
            return normalized;
        }

        // Remove leading ./
        if (normalized.startsWith('./')) {
            normalized = normalized.slice(2);
        }

        // Normalize directory patterns
        if (normalized.endsWith('/') && !normalized.endsWith('*/')) {
            // Keep trailing slash for directories
            return normalized;
        }

        return normalized;
    }

    /**
     * Check if a pattern already exists (accounting for variations)
     */
    hasPattern(pattern) {
        const normalized = this.normalizePattern(pattern);

        // Direct match
        if (this.patterns.has(normalized)) {
            return true;
        }

        // Check for equivalent patterns
        for (const existing of this.patterns) {
            if (this.patternsEquivalent(existing, normalized)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if two patterns are functionally equivalent
     */
    patternsEquivalent(pattern1, pattern2) {
        // Handle .env variations
        const envPatterns = ['.env', '.env*', '.env.*'];
        if (envPatterns.includes(pattern1) && envPatterns.includes(pattern2)) {
            return pattern1 === '.env*' || pattern2 === '.env*'; // .env* covers all
        }

        // Handle directory patterns
        const dir1 = pattern1.endsWith('/') ? pattern1.slice(0, -1) : pattern1;
        const dir2 = pattern2.endsWith('/') ? pattern2.slice(0, -1) : pattern2;

        return dir1 === dir2;
    }

    /**
     * Add new patterns to the gitignore
     */
    addPatterns(newPatterns, sectionTitle = null) {
        const patternsToAdd = newPatterns.filter(pattern => !this.hasPattern(pattern));

        if (patternsToAdd.length === 0) {
            return false; // No changes needed
        }

        // If file doesn't exist, create with just the new patterns
        if (!this.exists) {
            this.lines = [];
            if (sectionTitle) {
                this.lines.push(`# ${sectionTitle}`);
            }
            this.lines.push(...patternsToAdd);
            return true;
        }

        // Add to existing file
        const needsNewline = this.lines.length > 0 && this.lines[this.lines.length - 1].trim() !== '';

        if (needsNewline) {
            this.lines.push('');
        }

        if (sectionTitle) {
            this.lines.push(`# ${sectionTitle}`);
        }

        this.lines.push(...patternsToAdd);

        // Update our pattern tracking
        patternsToAdd.forEach(pattern => {
            this.patterns.add(this.normalizePattern(pattern));
        });

        return true;
    }

    /**
     * Write the gitignore file atomically
     */
    save() {
        const content = this.lines.join('\n');

        // Don't write if content hasn't changed
        if (this.exists && content === this.originalContent.replace(/\r?\n$/, '')) {
            return false;
        }

        const tempFile = `${this.filePath}.tmp`;

        try {
            // Write to temporary file first
            fs.writeFileSync(tempFile, content + '\n', 'utf8');

            // Atomic move
            fs.renameSync(tempFile, this.filePath);

            return true;
        } catch (error) {
            // Clean up temp file if it exists
            try {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            } catch (cleanupError) {
                // Ignore cleanup errors
            }

            throw new Error(`Failed to write .gitignore: ${error.message}`);
        }
    }

    /**
     * Get a preview of changes without writing
     */
    getPreview() {
        return {
            exists: this.exists,
            currentPatterns: Array.from(this.patterns).sort(),
            newContent: this.lines.join('\n')
        };
    }
}

/**
 * Update .gitignore for specified frameworks
 */
export function updateGitignore(frameworks, projectPath = '.') {
    const gitignorePath = path.join(projectPath, '.gitignore');
    const gitignore = new GitignoreFile(gitignorePath);

    const results = {
        updated: false,
        added: [],
        skipped: [],
        frameworks: frameworks
    };

    try {
        // Collect all patterns for the detected frameworks
        const allPatterns = new Set();

        frameworks.forEach(framework => {
            const patterns = gitignoreTemplates[framework] || gitignoreTemplates.generic;
            patterns.forEach(pattern => allPatterns.add(pattern));
        });

        // Always ensure basic security patterns
        const securityPatterns = ['.env*', '*.log', '.DS_Store'];
        securityPatterns.forEach(pattern => allPatterns.add(pattern));

        const patternsArray = Array.from(allPatterns);

        // Check what we're adding vs what exists
        patternsArray.forEach(pattern => {
            if (gitignore.hasPattern(pattern)) {
                results.skipped.push(pattern);
            } else {
                results.added.push(pattern);
            }
        });

        // Add new patterns
        if (results.added.length > 0) {
            const sectionTitle = `Secure Project - ${frameworks.join(', ')} patterns`;
            gitignore.addPatterns(results.added, sectionTitle);
            gitignore.save();
            results.updated = true;
        }

        return results;

    } catch (error) {
        throw new Error(`Failed to update .gitignore: ${error.message}`);
    }
}

/**
 * Preview what changes would be made without modifying files
 */
export function previewGitignoreChanges(frameworks, projectPath = '.') {
    const gitignorePath = path.join(projectPath, '.gitignore');
    const gitignore = new GitignoreFile(gitignorePath);

    const allPatterns = new Set();
    frameworks.forEach(framework => {
        const patterns = gitignoreTemplates[framework] || gitignoreTemplates.generic;
        patterns.forEach(pattern => allPatterns.add(pattern));
    });

    const securityPatterns = ['.env*', '*.log', '.DS_Store'];
    securityPatterns.forEach(pattern => allPatterns.add(pattern));

    const patternsArray = Array.from(allPatterns);
    const toAdd = patternsArray.filter(pattern => !gitignore.hasPattern(pattern));
    const existing = patternsArray.filter(pattern => gitignore.hasPattern(pattern));

    return {
        exists: gitignore.exists,
        toAdd,
        existing,
        preview: gitignore.getPreview()
    };
}

/**
 * Validate that .gitignore is properly configured
 */
export function validateGitignore(frameworks, projectPath = '.') {
    const gitignorePath = path.join(projectPath, '.gitignore');

    if (!fs.existsSync(gitignorePath)) {
        return {
            valid: false,
            issues: ['No .gitignore file found'],
            suggestions: ['Run secure-project init to create .gitignore']
        };
    }

    const gitignore = new GitignoreFile(gitignorePath);
    const issues = [];
    const suggestions = [];

    // Check for essential security patterns
    const essentialPatterns = ['.env*', '*.log'];
    essentialPatterns.forEach(pattern => {
        if (!gitignore.hasPattern(pattern)) {
            issues.push(`Missing pattern: ${pattern}`);
            suggestions.push(`Add ${pattern} to .gitignore`);
        }
    });

    // Check framework-specific patterns
    frameworks.forEach(framework => {
        const patterns = gitignoreTemplates[framework] || [];
        const missing = patterns.filter(pattern => !gitignore.hasPattern(pattern));

        if (missing.length > 0) {
            issues.push(`Missing ${framework} patterns: ${missing.join(', ')}`);
            suggestions.push(`Add ${framework}-specific patterns`);
        }
    });

    return {
        valid: issues.length === 0,
        issues,
        suggestions
    };
}