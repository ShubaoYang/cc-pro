# CCP - Claude Code Project Switcher

## Overview

A minimal CLI tool that lists all Claude Code projects with interactive selection, then launches `claude` in the selected project directory.

## Commands

```bash
ccp           # Interactive project selector → launch claude
ccp list      # Alias for the above
```

## Interactive Flow

1. Read all projects from `~/.claude/projects/`
2. Display interactive list sorted by last active time (descending)
3. User navigates with arrow keys, types to filter
4. On enter: launch `claude` in the selected project's directory via `execSync`

### Display Format

```
? 选择项目 (↑↓ 切换, 输入过滤)
❯ cc-pro             ~/Documents/code/liuding/cc-pro           1会话  2小时前
  doudizhu           ~/Documents/code/liuding/doudizhu         3会话  1天前
  agentic            ~/Documents/code/mindflow/ai/agentic      5会话  3天前
```

Each row shows:
- **Short name**: last segment of the project path. If duplicates exist, use `parent/name`.
- **Full path**: decoded real path with `~` prefix
- **Session count**: number of `.jsonl` files in the project directory
- **Last active**: relative time based on newest file mtime in the project directory

## Data Source

### Project Discovery

- Directory: `~/.claude/projects/`
- Each subdirectory name is an encoded path: `-Users-liuding-Documents-code-liuding-cc-pro`
- Decode algorithm (same as cc-tool): replace leading `-` with `/`, split all `-` into candidate segments, then greedily rebuild the path left-to-right by checking `fs.existsSync()` at each step. When a segment doesn't resolve as a directory, accumulate it with `-` (the `-` was part of the directory name, not a separator). This correctly handles directory names containing hyphens (e.g. `~/.openclaw/workspace` encoded as `--openclaw-workspace`).

### Session Count

- Count `.jsonl` files (excluding `agent-*.jsonl`) directly inside each project directory (not recursive)

### Last Active Time

- Use the most recent mtime among all files in the project directory

## Launch Behavior

```typescript
execSync('claude', { cwd: projectPath, stdio: 'inherit' });
```

- Inherits stdio so claude takes full control of the terminal
- On exit (normal or Ctrl+C), the ccp process exits cleanly

## Project Structure

```
cc-pro/
├── src/
│   └── index.ts        # All logic: project discovery, list, launch
├── bin/
│   └── ccp.js          # #!/usr/bin/env node entry point
├── package.json
├── tsconfig.json
└── .gitignore
```

## Dependencies

- `commander` — CLI argument parsing
- `chalk` — terminal colors
- `inquirer` — interactive list selection

## Edge Cases

- Project directory doesn't exist on disk → skip it, don't show in list
- No projects found → print message and exit
- Claude not installed → execSync throws, show error message
- Duplicate short names → disambiguate with parent directory prefix
