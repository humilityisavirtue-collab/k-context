# k-context

Generate CLAUDE.md and Cursor rules from any codebase. Make AI assistants actually understand your project.

## Installation

```bash
npx k-context init
```

Or install globally:

```bash
npm install -g k-context
```

## Usage

### Initialize in your project

```bash
cd your-project
npx k-context init
```

This creates:
- `CLAUDE.md` - Context file for Claude Code
- `.cursor/rules/project-context.mdc` - Context rules for Cursor

### Update context

```bash
k-context scan
```

### Check if context is stale

```bash
k-context status
```

## What it generates

### CLAUDE.md

A comprehensive context file that includes:
- Project structure and architecture
- Key files and their purposes
- Development commands (build, test, lint)
- Tech stack and dependencies
- Coding conventions detected in your codebase

### Cursor Rules

Auto-generated rules that help Cursor understand:
- File organization patterns
- Import conventions
- Testing patterns
- Framework-specific patterns (React, Vue, Svelte, etc.)

## Pricing

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 100 files, 1 project, local only |
| Pro | $19/month | Unlimited files, 5 projects, cloud sync |

## How it works

k-context uses semantic analysis to understand your codebase:

1. **Scans** your project structure and file contents
2. **Classifies** files by purpose (config, component, test, etc.)
3. **Extracts** patterns (imports, exports, naming conventions)
4. **Generates** context files optimized for AI assistants

## Privacy

- **Local-first**: Free tier works entirely offline
- **Your code stays yours**: We never store your source code
- **Minimal data**: Pro tier only syncs metadata for learning

## License

MIT
