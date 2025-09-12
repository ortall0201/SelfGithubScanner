# Self GitHub Scanner

Automated Lines of Code (LOC) statistics generator for GitHub repositories.

## Overview

This repository contains tools to automatically scan and generate comprehensive Lines of Code statistics for all your GitHub repositories. It provides both automated GitHub Actions workflows for public repositories and local scripts for analyzing private repositories.

## Features

- 🚀 **Automated Analysis**: GitHub Actions workflow runs weekly to analyze all public repositories
- 🔒 **Private Repository Support**: Local script can analyze private repositories with a GitHub token
- 📊 **Comprehensive Reports**: Detailed breakdown by language, repository, and totals
- 🎯 **Filtering Options**: Filter by file types, exclude forks/archived repositories
- 📈 **Historical Tracking**: Commit reports automatically to track changes over time

## Quick Start

### Automated Analysis (Public Repositories)

The GitHub Actions workflow automatically runs every Sunday and analyzes all your public repositories:

1. The workflow is already configured in `.github/workflows/loc-stats.yml`
2. It will generate a `LOC_REPORT.md` file with comprehensive statistics
3. Results are automatically committed to this repository

### Local Analysis (Including Private Repositories)

For analyzing private repositories or running analysis locally:

#### Prerequisites

Install required dependencies:

```bash
# On macOS
brew install cloc git

# On Ubuntu/Debian
sudo apt-get install cloc git curl

# On Windows (using chocolatey)
choco install cloc git curl
```

#### Setup

1. Create a GitHub Personal Access Token:
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate a new token with `repo` scope (for private repos) or `public_repo` scope (for public only)

2. Set environment variables:
   ```bash
   export GITHUB_TOKEN="ghp_your_token_here"
   export GITHUB_USERNAME="ortall0201"  # Optional, defaults to ortall0201
   ```

#### Usage

```bash
# Basic usage - analyze all repositories (including private)
node scripts/loc-all.mjs

# Analyze only specific file types
node scripts/loc-all.mjs --file-types js,ts,py,java

# Analyze only public repositories
node scripts/loc-all.mjs --exclude-private

# Include forks and archived repositories
node scripts/loc-all.mjs --include-forks --include-archived

# Custom output file
node scripts/loc-all.mjs --output MyCustomReport.md

# Specify token via command line
node scripts/loc-all.mjs --token ghp_your_token_here --username your_username
```

#### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--token <token>` | GitHub personal access token | `$GITHUB_TOKEN` |
| `--username <user>` | GitHub username to analyze | `ortall0201` |
| `--output <file>` | Output file path | `LOC_REPORT.md` |
| `--file-types <types>` | Comma-separated file types to include | All types |
| `--exclude-private` | Exclude private repositories | Include private |
| `--include-forks` | Include forked repositories | Exclude forks |
| `--include-archived` | Include archived repositories | Exclude archived |
| `--help` | Show help message | - |

#### File Type Filtering

Supported file type filters include:

- **JavaScript/TypeScript**: `js,ts,jsx,tsx`
- **Python**: `py`
- **Java**: `java`
- **C/C++**: `c,cpp,cc,cxx`
- **Go**: `go`
- **Rust**: `rs`
- **PHP**: `php`
- **Ruby**: `rb`
- **C#**: `cs`
- **Web**: `html,css,scss,sass,vue`

Example:
```bash
# Analyze only web development files
node scripts/loc-all.mjs --file-types js,ts,html,css,vue
```

## Report Format

The generated reports include:

1. **Repository Details**: Line-by-line breakdown of each repository by language
2. **Language Summary**: Total lines of code by programming language
3. **Grand Totals**: Overall statistics across all repositories
4. **Skipped Repositories**: List of repositories that couldn't be analyzed
5. **Successfully Processed**: List of all analyzed repositories

## Files Structure

```
├── .github/
│   └── workflows/
│       └── loc-stats.yml      # GitHub Actions workflow
├── scripts/
│   └── loc-all.mjs           # Local analysis script
├── README.md                 # This documentation
└── LOC_REPORT.md            # Generated statistics report
```

## Troubleshooting

### Common Issues

1. **Missing dependencies**: Ensure `cloc`, `git`, and `curl` are installed
2. **Authentication errors**: Verify your GitHub token has the correct permissions
3. **Rate limiting**: The script includes automatic retry logic for API rate limits
4. **Large repositories**: Very large repositories may timeout; consider using file type filters

### GitHub Actions Issues

1. **Workflow not running**: Check that the workflow file is in the correct location
2. **Permission errors**: Ensure the repository has Actions enabled
3. **Token issues**: The workflow uses `GITHUB_TOKEN` automatically provided by GitHub

## Contributing

Feel free to submit issues or pull requests to improve the analysis tools.

## License

See LICENSE file for details.