# secure-commit

🛡️ **Prevent secrets from being committed to your Git repositories**

A lightweight CLI tool that automatically detects and blocks API keys, passwords, and other sensitive data from being committed to version control.

## Features

- 🔍 **Smart Detection** - Detects AWS keys, Stripe keys, OpenAI tokens, database URLs, and more
- 🪝 **Git Integration** - Automatic pre-commit hooks to prevent accidents
- 🚀 **Zero Config** - Works out of the box with sensible defaults
- ⚡ **Fast & Lightweight** - Minimal dependencies, maximum performance
- 🎯 **Developer Friendly** - Clear error messages and helpful suggestions

## Quick Start

### Scan your project for secrets

```bash
npx secure-commit scan
```

### Install protection (recommended)

```bash
npx secure-commit install
```

This installs a git pre-commit hook that automatically scans files before each commit.

### Full setup (gitignore + hooks)

```bash
npx secure-commit init
```

## Commands

| Command | Description |
|---------|-------------|
| `npx secure-commit scan` | Scan current directory for secrets |
| `npx secure-commit install` | Install git pre-commit hooks |
| `npx secure-commit uninstall` | Remove git pre-commit hooks |
| `npx secure-commit init` | Setup .gitignore patterns and install hooks |
| `npx secure-commit clean` | Remove tracked sensitive files from git |
| `npx secure-commit preview` | Preview .gitignore changes |

## What it detects

- **AWS Access Keys** (`AKIA...`)
- **Stripe API Keys** (`sk_live_...`, `sk_test_...`)
- **OpenAI API Keys** (`sk-...`)
- **GitHub Personal Access Tokens** (`ghp_...`)
- **Google API Keys** (`AIza...`)
- **Database Connection Strings** (connection URLs with credentials)

## Examples

### Basic usage
```bash
# Scan for secrets
npx secure-commit scan

# Install protection
npx secure-commit install

# Test with a dummy secret (will be blocked)
echo "const key = 'your-api-key-here'" > test.js
git add test.js
git commit -m "test" # This will be blocked!
```

### Using flags
```bash
# Force reinstall hooks
npx secure-commit install --force

# Preview cleanup without making changes
npx secure-commit clean --preview
```

## How it works

1. **Pre-commit Hook**: When you try to commit, the hook scans staged files
2. **Pattern Matching**: Uses regex patterns to identify secret formats
3. **Immediate Feedback**: Shows exactly what was found and where
4. **Helpful Guidance**: Suggests how to fix the issue

## Bypass protection

Sometimes you need to commit test data or examples:

```bash
# Skip the pre-commit hook (use carefully!)
git commit --no-verify -m "Add test fixtures"
```

## Configuration

The tool works without configuration, but you can customize:

- Add patterns to `.gitignore` 
- Modify the pre-commit hook for custom behavior
- Use with existing git hooks (they're preserved)

## Requirements

- Node.js 14+
- Git repository

## License

MIT © Samuel Umoren