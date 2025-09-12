#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

class LOCAnalyzer {
  constructor(options = {}) {
    this.token = options.token || process.env.GITHUB_TOKEN;
    this.username = options.username || process.env.GITHUB_USERNAME || 'ortall0201';
    this.includePrivate = options.includePrivate !== false;
    this.includeForks = options.includeForks || false;
    this.includeArchived = options.includeArchived || false;
    this.outputFile = options.outputFile || 'LOC_REPORT.md';
    this.fileTypes = options.fileTypes || null; // e.g., ['js', 'ts', 'py']
    this.tempDir = 'temp_repos_local';
    
    if (!this.token) {
      console.error('Error: GITHUB_TOKEN environment variable or --token option is required');
      process.exit(1);
    }
  }

  async fetchRepositories() {
    console.log(`Fetching repositories for user: ${this.username}`);
    console.log(`Include private: ${this.includePrivate}`);
    console.log(`Include forks: ${this.includeForks}`);
    console.log(`Include archived: ${this.includeArchived}`);
    
    const repos = [];
    let page = 1;
    const perPage = 100;
    
    while (true) {
      try {
        const url = `https://api.github.com/user/repos?type=${this.includePrivate ? 'all' : 'public'}&per_page=${perPage}&page=${page}&sort=updated`;
        const response = execSync(`curl -s -H "Authorization: token ${this.token}" "${url}"`, { encoding: 'utf8' });
        const pageRepos = JSON.parse(response);
        
        if (!Array.isArray(pageRepos) || pageRepos.length === 0) {
          break;
        }
        
        const filteredRepos = pageRepos.filter(repo => {
          if (!this.includeForks && repo.fork) return false;
          if (!this.includeArchived && repo.archived) return false;
          if (repo.owner.login !== this.username) return false; // Only user's repos
          return true;
        });
        
        repos.push(...filteredRepos);
        
        if (pageRepos.length < perPage) {
          break;
        }
        
        page++;
      } catch (error) {
        console.error(`Error fetching repositories page ${page}:`, error.message);
        break;
      }
    }
    
    console.log(`Found ${repos.length} repositories to analyze`);
    return repos;
  }

  runCloc(repoPath) {
    try {
      let clocCmd = 'cloc . --json';
      
      // Add file type filters if specified
      if (this.fileTypes && this.fileTypes.length > 0) {
        const extensions = this.fileTypes.map(type => {
          // Map common language names to file extensions
          const extMap = {
            'js': 'js',
            'javascript': 'js',
            'ts': 'ts',
            'typescript': 'ts',
            'py': 'py',
            'python': 'py',
            'java': 'java',
            'cpp': 'cpp,cc,cxx',
            'c': 'c',
            'go': 'go',
            'rust': 'rs',
            'php': 'php',
            'rb': 'rb',
            'ruby': 'rb',
            'cs': 'cs',
            'html': 'html,htm',
            'css': 'css',
            'scss': 'scss',
            'sass': 'sass',
            'vue': 'vue',
            'jsx': 'jsx',
            'tsx': 'tsx'
          };
          return extMap[type.toLowerCase()] || type;
        }).join(',');
        
        clocCmd += ` --include-ext=${extensions}`;
      }
      
      const output = execSync(clocCmd, { cwd: repoPath, encoding: 'utf8' });
      return JSON.parse(output);
    } catch (error) {
      console.warn(`CLOC failed for ${repoPath}: ${error.message}`);
      return null;
    }
  }

  async analyzeRepository(repo) {
    const repoPath = join(this.tempDir, repo.name);
    
    try {
      console.log(`Analyzing: ${repo.name} (${repo.private ? 'private' : 'public'})`);
      
      // Clone repository
      const cloneCmd = `git clone --depth 1 --branch ${repo.default_branch} ${repo.clone_url} "${repoPath}"`;
      execSync(cloneCmd, { stdio: 'pipe' });
      
      // Run CLOC analysis
      const clocResult = this.runCloc(repoPath);
      
      if (!clocResult) {
        return { repo: repo.name, status: 'cloc_failed' };
      }
      
      // Process results
      const languages = {};
      let repoTotalFiles = 0;
      let repoTotalBlank = 0;
      let repoTotalComment = 0;
      let repoTotalCode = 0;
      
      for (const [lang, stats] of Object.entries(clocResult)) {
        if (lang === 'header' || lang === 'SUM') continue;
        
        const files = stats.nFiles || 0;
        const blank = stats.blank || 0;
        const comment = stats.comment || 0;
        const code = stats.code || 0;
        
        if (code > 0) {
          languages[lang] = { files, blank, comment, code };
          repoTotalFiles += files;
          repoTotalBlank += blank;
          repoTotalComment += comment;
          repoTotalCode += code;
        }
      }
      
      return {
        repo: repo.name,
        status: 'success',
        isPrivate: repo.private,
        languages,
        totals: {
          files: repoTotalFiles,
          blank: repoTotalBlank,
          comment: repoTotalComment,
          code: repoTotalCode
        }
      };
      
    } catch (error) {
      console.warn(`Failed to analyze ${repo.name}: ${error.message}`);
      return { repo: repo.name, status: 'clone_failed', error: error.message };
    } finally {
      // Cleanup
      if (existsSync(repoPath)) {
        rmSync(repoPath, { recursive: true, force: true });
      }
    }
  }

  generateReport(results) {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    
    let report = `# Lines of Code Statistics\n\n`;
    report += `Generated on: ${timestamp}\n`;
    report += `Username: ${this.username}\n`;
    report += `Include private repos: ${this.includePrivate}\n`;
    report += `Include forks: ${this.includeForks}\n`;
    report += `Include archived: ${this.includeArchived}\n`;
    
    if (this.fileTypes) {
      report += `File types filter: ${this.fileTypes.join(', ')}\n`;
    }
    
    report += `\n## Repository Details\n\n`;
    report += `| Repository | Type | Language | Files | Blank Lines | Comments | Code Lines |\n`;
    report += `|------------|------|----------|-------|-------------|----------|------------|\n`;
    
    const languageTotals = {};
    let grandTotalFiles = 0;
    let grandTotalBlank = 0;
    let grandTotalComment = 0;
    let grandTotalCode = 0;
    const processedRepos = [];
    const skippedRepos = [];
    
    for (const result of results) {
      if (result.status === 'success') {
        processedRepos.push(result.repo);
        const repoType = result.isPrivate ? 'Private' : 'Public';
        
        for (const [lang, stats] of Object.entries(result.languages)) {
          report += `| ${result.repo} | ${repoType} | ${lang} | ${stats.files} | ${stats.blank} | ${stats.comment} | ${stats.code} |\n`;
          
          // Accumulate language totals
          if (!languageTotals[lang]) {
            languageTotals[lang] = { files: 0, blank: 0, comment: 0, code: 0 };
          }
          languageTotals[lang].files += stats.files;
          languageTotals[lang].blank += stats.blank;
          languageTotals[lang].comment += stats.comment;
          languageTotals[lang].code += stats.code;
        }
        
        grandTotalFiles += result.totals.files;
        grandTotalBlank += result.totals.blank;
        grandTotalComment += result.totals.comment;
        grandTotalCode += result.totals.code;
      } else {
        skippedRepos.push(`${result.repo} (${result.status})`);
      }
    }
    
    // Language summary
    report += `\n## Language Summary\n\n`;
    report += `| Language | Total Files | Total Lines of Code |\n`;
    report += `|----------|-------------|---------------------|\n`;
    
    const sortedLanguages = Object.entries(languageTotals)
      .sort(([,a], [,b]) => b.code - a.code);
      
    for (const [lang, totals] of sortedLanguages) {
      report += `| ${lang} | ${totals.files} | ${totals.code} |\n`;
    }
    
    // Grand totals
    report += `\n## Grand Totals\n\n`;
    report += `- **Total Repositories Analyzed:** ${processedRepos.length}\n`;
    report += `- **Total Files:** ${grandTotalFiles.toLocaleString()}\n`;
    report += `- **Total Blank Lines:** ${grandTotalBlank.toLocaleString()}\n`;
    report += `- **Total Comments:** ${grandTotalComment.toLocaleString()}\n`;
    report += `- **Total Lines of Code:** ${grandTotalCode.toLocaleString()}\n\n`;
    
    // Skipped repositories
    if (skippedRepos.length > 0) {
      report += `## Skipped Repositories\n\n`;
      report += `The following repositories were skipped:\n\n`;
      for (const repo of skippedRepos) {
        report += `- ${repo}\n`;
      }
      report += `\n`;
    }
    
    // Processed repositories
    report += `## Successfully Processed Repositories\n\n`;
    for (const repo of processedRepos) {
      report += `- ${repo}\n`;
    }
    
    return report;
  }

  async run() {
    console.log('Starting LOC analysis...');
    
    // Create temp directory
    if (existsSync(this.tempDir)) {
      rmSync(this.tempDir, { recursive: true, force: true });
    }
    mkdirSync(this.tempDir, { recursive: true });
    
    try {
      // Fetch repositories
      const repos = await this.fetchRepositories();
      
      if (repos.length === 0) {
        console.log('No repositories found to analyze');
        return;
      }
      
      // Analyze each repository
      const results = [];
      for (const repo of repos) {
        const result = await this.analyzeRepository(repo);
        results.push(result);
      }
      
      // Generate and save report
      const report = this.generateReport(results);
      writeFileSync(this.outputFile, report);
      
      console.log(`\nAnalysis complete! Report saved to: ${this.outputFile}`);
      console.log(`Total repositories analyzed: ${results.filter(r => r.status === 'success').length}`);
      console.log(`Total repositories skipped: ${results.filter(r => r.status !== 'success').length}`);
      
    } finally {
      // Cleanup temp directory
      if (existsSync(this.tempDir)) {
        rmSync(this.tempDir, { recursive: true, force: true });
      }
    }
  }
}

// CLI interface
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--token':
        options.token = args[++i];
        break;
      case '--username':
        options.username = args[++i];
        break;
      case '--output':
        options.outputFile = args[++i];
        break;
      case '--file-types':
        options.fileTypes = args[++i].split(',').map(t => t.trim());
        break;
      case '--exclude-private':
        options.includePrivate = false;
        break;
      case '--include-forks':
        options.includeForks = true;
        break;
      case '--include-archived':
        options.includeArchived = true;
        break;
      case '--help':
        console.log(`
GitHub LOC Analyzer

Usage: node scripts/loc-all.mjs [options]

Options:
  --token <token>        GitHub personal access token (or set GITHUB_TOKEN env var)
  --username <username>  GitHub username (or set GITHUB_USERNAME env var, default: ortall0201)
  --output <file>        Output file path (default: LOC_REPORT.md)
  --file-types <types>   Comma-separated list of file types to include (e.g., js,ts,py)
  --exclude-private      Exclude private repositories
  --include-forks        Include forked repositories
  --include-archived     Include archived repositories
  --help                 Show this help message

Environment Variables:
  GITHUB_TOKEN          GitHub personal access token
  GITHUB_USERNAME       GitHub username (default: ortall0201)

Examples:
  # Analyze all repositories (including private)
  node scripts/loc-all.mjs --token ghp_xxxxx
  
  # Analyze only JavaScript and TypeScript files
  node scripts/loc-all.mjs --file-types js,ts,jsx,tsx
  
  # Analyze only public repositories
  node scripts/loc-all.mjs --exclude-private
  
  # Include forks and archived repos
  node scripts/loc-all.mjs --include-forks --include-archived
        `);
        process.exit(0);
        break;
    }
  }
  
  return options;
}

// Check dependencies
function checkDependencies() {
  const deps = ['git', 'cloc', 'curl'];
  const missing = [];
  
  for (const dep of deps) {
    try {
      execSync(`which ${dep}`, { stdio: 'pipe' });
    } catch (error) {
      missing.push(dep);
    }
  }
  
  if (missing.length > 0) {
    console.error(`Missing required dependencies: ${missing.join(', ')}`);
    console.error('Please install the missing dependencies and try again.');
    process.exit(1);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  checkDependencies();
  const options = parseArgs();
  const analyzer = new LOCAnalyzer(options);
  analyzer.run().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}