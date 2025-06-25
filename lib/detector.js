import fs from 'fs';
import path from 'path';
import { secretPatterns, fileExtensions, ignoreDirs, sensitiveFiles } from './patterns.js';

export function detectFramework(projectPath = '.') {
    const frameworks = [];

    // Check for Node.js
    if (fs.existsSync(path.join(projectPath, 'package.json'))) {
        frameworks.push('node');
    }

    // Check for Python
    if (fs.existsSync(path.join(projectPath, 'requirements.txt')) ||
        fs.existsSync(path.join(projectPath, 'Pipfile')) ||
        fs.existsSync(path.join(projectPath, 'pyproject.toml'))) {
        frameworks.push('python');
    }

    // Check for PHP
    if (fs.existsSync(path.join(projectPath, 'composer.json'))) {
        frameworks.push('php');
    }

    // Check for Ruby
    if (fs.existsSync(path.join(projectPath, 'Gemfile'))) {
        frameworks.push('ruby');
    }

    // Check for Java
    if (fs.existsSync(path.join(projectPath, 'pom.xml')) ||
        fs.existsSync(path.join(projectPath, 'build.gradle'))) {
        frameworks.push('java');
    }

    return frameworks.length > 0 ? frameworks : ['generic'];
}

export function shouldScanFile(filePath) {
    const ext = path.extname(filePath);
    const fileName = path.basename(filePath);

    // Always scan .env files
    if (fileName.startsWith('.env')) {
        return true;
    }

    // Check file extensions
    return fileExtensions.includes(ext);
}

export function shouldIgnoreDir(dirName) {
    return ignoreDirs.includes(dirName);
}

export function scanFileForSecrets(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const findings = [];

        for (const [secretType, config] of Object.entries(secretPatterns)) {
            lines.forEach((line, lineNumber) => {
                const matches = [...line.matchAll(config.pattern)];

                matches.forEach(match => {
                    findings.push({
                        file: path.relative('.', filePath),
                        line: lineNumber + 1,
                        type: secretType,
                        description: config.description,
                        suggestion: config.suggestion,
                        match: match[0].substring(0, 12) + '...', // Show first 12 chars
                        severity: getSeverity(secretType)
                    });
                });
            });
        }

        return findings;
    } catch (error) {
        console.warn(`⚠️  Could not read file: ${filePath} - ${error.message}`);
        return [];
    }
}

export function findTrackedSensitiveFiles(projectPath = '.') {
    const trackedFiles = [];

    try {
        const { execSync } = require('child_process');
        const gitFiles = execSync('git ls-files', {
            cwd: projectPath,
            encoding: 'utf8'
        }).split('\n').filter(Boolean);

        // Check if any tracked files match sensitive patterns
        gitFiles.forEach(file => {
            const fileName = path.basename(file);

            if (sensitiveFiles.some(pattern => {
                if (pattern.includes('*')) {
                    const regex = new RegExp(pattern.replace('*', '.*'));
                    return regex.test(fileName);
                }
                return fileName === pattern;
            })) {
                trackedFiles.push(file);
            }
        });

    } catch (error) {
        // Not a git repo or git not available - return empty array silently
        return [];
    }

    return trackedFiles;
}

export function scanDirectory(dirPath = '.') {
    const allFindings = [];

    function scanRecursive(currentPath) {
        try {
            const items = fs.readdirSync(currentPath);

            for (const item of items) {
                const fullPath = path.join(currentPath, item);

                try {
                    const stat = fs.statSync(fullPath);

                    if (stat.isDirectory()) {
                        if (!shouldIgnoreDir(item)) {
                            scanRecursive(fullPath);
                        }
                    } else if (stat.isFile() && shouldScanFile(fullPath)) {
                        const findings = scanFileForSecrets(fullPath);
                        allFindings.push(...findings);
                    }
                } catch (error) {
                    // Skip files we can't access
                    continue;
                }
            }
        } catch (error) {
            console.warn(`⚠️  Could not read directory: ${currentPath}`);
        }
    }

    scanRecursive(dirPath);
    return allFindings;
}

function getSeverity(secretType) {
    const highRisk = ['stripe_live', 'aws_access', 'jwt_secret', 'database_url'];
    const mediumRisk = ['openai', 'github_token'];

    if (highRisk.includes(secretType)) return 'high';
    if (mediumRisk.includes(secretType)) return 'medium';
    return 'low';
}