#!/usr/bin/env node

// bin/cli.js

import { detectFramework, scanDirectory, findTrackedSensitiveFiles } from '../lib/detector.js';
import { updateGitignore, previewGitignoreChanges, validateGitignore } from '../lib/gitignore.js';
import { removeTrackedSensitiveFiles, previewCleanup, validateCleanupSafety } from '../lib/cleaner.js';
import { installHooks, uninstallHooks, checkHookInstallation } from '../lib/hooks.js';

function displayFindings(findings) {
    if (findings.length === 0) {
        console.log('✅ No secrets detected!');
        return false;
    }

    console.log(`❌ Found ${findings.length} potential secret(s):\n`);

    // Group by severity
    const grouped = findings.reduce((acc, finding) => {
        acc[finding.severity] = acc[finding.severity] || [];
        acc[finding.severity].push(finding);
        return acc;
    }, {});

    // Show high severity first
    ['high', 'medium', 'low'].forEach(severity => {
        if (grouped[severity]) {
            const icon = severity === 'high' ? '🚨' : severity === 'medium' ? '⚠️' : '💡';
            console.log(`${icon} ${severity.toUpperCase()} RISK:\n`);

            grouped[severity].forEach((finding, index) => {
                console.log(`   ${finding.description}`);
                console.log(`   📁 ${finding.file}:${finding.line}`);
                console.log(`   🔑 ${finding.match}`);
                console.log(`   💡 ${finding.suggestion}\n`);
            });
        }
    });

    return true;
}

function displayTrackedFiles(trackedFiles) {
    if (!trackedFiles || trackedFiles.length === 0) {
        console.log('✅ No sensitive files tracked in git');
        return false;
    }

    console.log(`🔍 Found ${trackedFiles.length} sensitive file(s) already tracked in git:\n`);

    trackedFiles.forEach(file => {
        console.log(`   📁 ${file}`);
    });

    console.log('\n💡 Run with --clean to remove these from git tracking\n');
    return true;
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'scan';
    const hasFlag = (flag) => args.includes(flag);
    const targetDir = '.';

    console.log('🛡️  Secure Project - Protecting your secrets\n');

    if (command === 'scan') {
        // Detect framework
        const frameworks = detectFramework(targetDir);
        console.log(`📦 Detected: ${frameworks.join(', ')}\n`);

        // Scan for secrets in files
        const findings = scanDirectory(targetDir);
        const hasSecrets = displayFindings(findings);

        // Check for tracked sensitive files
        const trackedFiles = findTrackedSensitiveFiles(targetDir);
        const hasTrackedFiles = displayTrackedFiles(trackedFiles);

        // Summary
        if (!hasSecrets && !hasTrackedFiles) {
            console.log('\n🎉 Your project looks secure!');
            console.log('💡 Run `npx secure-commit install` to set up prevention hooks');
        }

        process.exit(hasSecrets || hasTrackedFiles ? 1 : 0);
    }
    else if (command === 'clean') {
        const dryRun = hasFlag('--preview') || hasFlag('--dry-run');
        const force = hasFlag('--force');

        console.log('🧹 Cleaning tracked sensitive files...\n');

        try {
            // Validate safety first
            const safety = validateCleanupSafety(targetDir);

            if (!safety.safe) {
                console.error('❌ Cannot proceed with cleanup:');
                safety.issues.forEach(issue => console.error(`   ${issue}`));
                process.exit(1);
            }

            if (safety.warnings.length > 0 && !force) {
                console.log('⚠️  Warnings:');
                safety.warnings.forEach(warning => console.log(`   ${warning}`));
                console.log('');
            }

            const result = await removeTrackedSensitiveFiles(targetDir, { dryRun, force });

            if (result.removed.length === 0 && result.skipped.length === 0 && result.failed.length === 0) {
                console.log('✅ No tracked sensitive files found');
                return;
            }

            if (result.removed.length > 0) {
                console.log(`${dryRun ? '🔍 Would remove' : '✅ Removed'} ${result.removed.length} file(s):`);
                result.removed.forEach(({ file, status }) => {
                    console.log(`   - ${file} (${status})`);
                });
                console.log('');
            }

            if (result.skipped.length > 0) {
                console.log(`⏭️  Skipped ${result.skipped.length} file(s):`);
                result.skipped.forEach(({ file, reason }) => {
                    console.log(`   - ${file} (${reason})`);
                });
                console.log('');
            }

            if (result.failed.length > 0) {
                console.log(`❌ Failed to remove ${result.failed.length} file(s):`);
                result.failed.forEach(({ file, error }) => {
                    console.log(`   - ${file}: ${error}`);
                });
                console.log('');
            }

            if (result.warnings.length > 0) {
                result.warnings.forEach(warning => console.log(`⚠️  ${warning}`));
                console.log('');
            }

            if (dryRun && result.removed.length > 0) {
                console.log('💡 Run `secure-project clean` to actually remove these files');
            } else if (!dryRun && result.removed.length > 0) {
                console.log('💡 Files removed from git tracking but kept on disk');
                console.log('💡 Add these patterns to .gitignore to prevent re-tracking');
            }

        } catch (error) {
            console.error(`❌ Cleanup failed: ${error.message}`);
            process.exit(1);
        }
    }
    else if (command === 'preview') {
        const frameworks = detectFramework(targetDir);
        console.log(`📦 Detected: ${frameworks.join(', ')}\n`);

        const preview = previewGitignoreChanges(frameworks, targetDir);

        if (preview.toAdd.length === 0) {
            console.log('✅ .gitignore is already properly configured!');
        } else {
            console.log(`📝 Would add ${preview.toAdd.length} new pattern(s) to .gitignore:\n`);
            preview.toAdd.forEach(pattern => {
                console.log(`   + ${pattern}`);
            });

            if (preview.existing.length > 0) {
                console.log(`\n✅ Already present: ${preview.existing.join(', ')}`);
            }

            console.log('\n💡 Run `secure-project init` to apply these changes');
        }
    }
    else if (command === 'init') {
        const frameworks = detectFramework(targetDir);
        console.log(`📦 Setting up security for: ${frameworks.join(', ')}\n`);

        try {
            const result = updateGitignore(frameworks, targetDir);

            if (result.updated) {
                console.log(`✅ Updated .gitignore with ${result.added.length} new pattern(s)`);
                result.added.forEach(pattern => {
                    console.log(`   + ${pattern}`);
                });

                if (result.skipped.length > 0) {
                    console.log(`\n⏭️  Skipped ${result.skipped.length} existing pattern(s)`);
                }
            } else {
                console.log('✅ .gitignore already properly configured!');
            }

            // Also install hooks if not already installed
            const hookStatus = checkHookInstallation(targetDir);
            if (!hookStatus.installed) {
                console.log('\n🪝 Installing git hooks...');
                try {
                    const hookResult = installHooks(targetDir);
                    if (hookResult.success) {
                        console.log('✅ Git hooks installed successfully');
                        console.log('🛡️  Your repository is now protected against secret commits');
                    } else {
                        console.log(`⚠️  Hook installation completed with warnings: ${hookResult.message}`);
                    }
                } catch (hookError) {
                    console.error(`⚠️  Failed to install hooks: ${hookError.message}`);
                    console.log('💡 You can try running `npx secure-commit install` separately');
                }
            } else {
                console.log('\n✅ Git hooks already installed');
            }
        } catch (error) {
            console.error(`❌ Failed to update .gitignore: ${error.message}`);
            process.exit(1);
        }
    }
    else if (command === 'install') {
        console.log('🪝 Installing git pre-commit hooks...\n');
        
        try {
            const hookStatus = checkHookInstallation(targetDir);
            
            if (hookStatus.installed) {
                console.log('✅ Git hooks are already installed');
                console.log(`📄 Hook file: ${hookStatus.hookPath}`);
                
                if (hasFlag('--force')) {
                    console.log('🔄 Reinstalling due to --force flag...');
                } else {
                    console.log('\n💡 Use --force to reinstall');
                    return;
                }
            }
            
            const result = installHooks(targetDir, { force: hasFlag('--force') });
            
            if (result.success) {
                console.log('✅ Git hooks installed successfully!');
                console.log(`📄 Hook installed at: ${result.hookPath}`);
                console.log('\n🛡️  Your repository is now protected against secret commits');
                console.log('💡 Test it by trying to commit a file with an API key');
            } else {
                console.log(`⚠️  Installation completed with issues: ${result.message}`);
                if (result.hookPath) {
                    console.log(`📄 Hook location: ${result.hookPath}`);
                }
            }
            
        } catch (error) {
            console.error(`❌ Failed to install hooks: ${error.message}`);
            process.exit(1);
        }
    }
    else if (command === 'uninstall') {
        console.log('🗑️  Uninstalling git pre-commit hooks...\n');
        
        try {
            const hookStatus = checkHookInstallation(targetDir);
            
            if (!hookStatus.installed) {
                console.log('ℹ️  No git hooks found to uninstall');
                return;
            }
            
            const result = uninstallHooks(targetDir);
            
            if (result.success) {
                console.log('✅ Git hooks uninstalled successfully');
                console.log('ℹ️  Your repository no longer has automatic secret protection');
            } else {
                console.log(`⚠️  Uninstallation completed with issues: ${result.message}`);
            }
            
        } catch (error) {
            console.error(`❌ Failed to uninstall hooks: ${error.message}`);
            process.exit(1);
        }
    }
    else {
        console.log('Usage:');
        console.log('  npx secure-commit scan            # Scan for secrets');
        console.log('  npx secure-commit install         # Install git pre-commit hooks');
        console.log('  npx secure-commit uninstall       # Remove git pre-commit hooks');
        console.log('  npx secure-commit init            # Setup .gitignore and hooks');
        console.log('  npx secure-commit preview         # Preview .gitignore changes');
        console.log('  npx secure-commit clean           # Remove tracked sensitive files');
        console.log('  npx secure-commit clean --preview # Preview cleanup');
        console.log('');
        console.log('Flags:');
        console.log('  --force                           # Force reinstall/overwrite');
        console.log('  --preview, --dry-run              # Preview changes without applying');
    }
}

main().catch(error => {
    console.error(`❌ Unexpected error: ${error.message}`);
    process.exit(1);
});