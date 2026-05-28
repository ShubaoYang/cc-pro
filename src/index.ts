import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { program } from 'commander';

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

interface Project {
  encodedName: string;
  fullPath: string;
  shortName: string;
  sessionCount: number;
  lastActive: number; // timestamp ms
}

/**
 * Decode encoded project directory name to real filesystem path.
 * Algorithm: replace leading `-` with `/`, split on `-`, then greedily
 * rebuild left-to-right checking fs.existsSync at each step.
 */
function decodePath(encoded: string): { fullPath: string; shortName: string } {
  const pathStr = encoded.replace(/^-/, '/').replace(/-/g, '/');
  const segments = pathStr.split('/').filter((s) => s);

  const realSegments: string[] = [];
  let accumulated = '';

  for (const seg of segments) {
    accumulated = accumulated ? accumulated + '-' + seg : seg;
    const testPath = '/' + realSegments.concat(accumulated).join('/');
    if (fs.existsSync(testPath)) {
      realSegments.push(accumulated);
      accumulated = '';
    }
  }

  if (accumulated) {
    realSegments.push(accumulated);
  }

  const fullPath = '/' + realSegments.join('/');
  const shortName = realSegments[realSegments.length - 1] || encoded;
  return { fullPath, shortName };
}

/**
 * Discover all Claude Code projects from ~/.claude/projects/
 */
function discoverProjects(): Project[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];

  const dirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  const projects: Project[] = [];

  for (const dir of dirs) {
    const { fullPath, shortName } = decodePath(dir.name);

    // Skip if real path doesn't exist on disk
    if (!fs.existsSync(fullPath)) continue;

    const projectDir = path.join(PROJECTS_DIR, dir.name);
    const files = fs.readdirSync(projectDir);
    const jsonlFiles = files.filter(
      (f) => f.endsWith('.jsonl') && !f.startsWith('agent-')
    );

    let lastActive = 0;
    for (const f of files) {
      try {
        const stat = fs.statSync(path.join(projectDir, f));
        if (stat.mtimeMs > lastActive) lastActive = stat.mtimeMs;
      } catch {}
    }

    projects.push({
      encodedName: dir.name,
      fullPath,
      shortName,
      sessionCount: jsonlFiles.length,
      lastActive,
    });
  }

  // Disambiguate duplicate short names
  const nameCount = new Map<string, number>();
  for (const p of projects) {
    nameCount.set(p.shortName, (nameCount.get(p.shortName) || 0) + 1);
  }
  for (const p of projects) {
    if (nameCount.get(p.shortName)! > 1) {
      const parts = p.fullPath.split('/');
      const parent = parts[parts.length - 2];
      if (parent) p.shortName = parent + '/' + p.shortName;
    }
  }

  // Sort by last active descending
  projects.sort((a, b) => b.lastActive - a.lastActive);

  return projects;
}

/**
 * Format a timestamp as relative time string (e.g. "2小时前")
 */
function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const months = Math.floor(days / 30);
  return `${months}个月前`;
}

function displayPath(fullPath: string): string {
  const home = os.homedir();
  return fullPath.startsWith(home) ? '~' + fullPath.slice(home.length) : fullPath;
}

async function selectAndLaunch(): Promise<void> {
  const projects = discoverProjects();

  if (projects.length === 0) {
    console.log(chalk.yellow('没有找到 Claude Code 项目'));
    return;
  }

  // Build choices for inquirer
  const maxName = Math.max(...projects.map((p) => p.shortName.length));
  const maxPath = Math.max(...projects.map((p) => displayPath(p.fullPath).length));

  const choices = projects.map((p) => {
    const name = p.shortName.padEnd(maxName + 2);
    const dp = displayPath(p.fullPath).padEnd(maxPath + 2);
    const sessions = `${p.sessionCount}会话`.padEnd(6);
    const time = relativeTime(p.lastActive);
    return {
      name: `${name} ${chalk.gray(dp)} ${chalk.cyan(sessions)} ${chalk.gray(time)}`,
      value: p,
      short: p.shortName,
    };
  });

  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message: '选择项目',
      choices,
      pageSize: 20,
      loop: false,
    },
  ]);

  const project = selected as Project;

  console.log(chalk.green(`\n启动 Claude → ${project.shortName}`));
  console.log(chalk.gray(`目录: ${project.fullPath}\n`));

  // Clean up stdin before handing off to claude
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    try { process.stdin.setRawMode(false); } catch {}
  }
  process.stdin.removeAllListeners();
  process.stdin.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EIO' || err.code === 'ENOTTY') process.exit(0);
  });
  process.stdin.pause();

  try {
    execSync('claude', { cwd: project.fullPath, stdio: 'inherit' });
    process.exit(0);
  } catch (error: any) {
    if (error.signal === 'SIGINT') {
      process.exit(0);
    } else if (error.status !== undefined) {
      process.exit(error.status);
    } else {
      console.log(chalk.red(`启动失败: ${error.message}`));
      process.exit(1);
    }
  }
}

program
  .name('ccp')
  .description('Claude Code project switcher')
  .version('0.1.0');

program
  .command('list', { isDefault: true })
  .description('交互式选择项目并启动 Claude')
  .action(selectAndLaunch);

program.parse();
