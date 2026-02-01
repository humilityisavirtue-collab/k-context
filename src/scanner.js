import fg from 'fast-glob';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { execSync } from 'child_process';

// Language detection by extension
const LANGUAGE_MAP = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.php': 'php',
  '.cs': 'csharp',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.hpp': 'cpp',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.astro': 'astro',
  '.md': 'markdown',
  '.mdx': 'mdx',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.sql': 'sql',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
  '.html': 'html',
};

// File patterns to always ignore (glob patterns for fast-glob)
const DEFAULT_IGNORES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.svelte-kit/**',
  '**/coverage/**',
  '**/.cache/**',
  '**/*.min.js',
  '**/*.bundle.js',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/.env*',
  '**/*.log',
];

// Patterns for identifying file purposes
const FILE_PATTERNS = {
  config: [
    /^\..*rc$/,
    /config\.(js|ts|json|yaml|yml|toml)$/,
    /^tsconfig.*\.json$/,
    /^package\.json$/,
    /^vite\.config\./,
    /^next\.config\./,
    /^svelte\.config\./,
    /^astro\.config\./,
    /^tailwind\.config\./,
    /^postcss\.config\./,
    /^eslint\.config\./,
    /^prettier\.config\./,
    /\.config\.(js|ts|mjs|cjs)$/,
  ],
  test: [
    /\.test\.(js|ts|jsx|tsx)$/,
    /\.spec\.(js|ts|jsx|tsx)$/,
    /_test\.(go|py)$/,
    /test_.*\.py$/,
    /^__tests__\//,
    /^tests?\//,
  ],
  component: [
    /components?\/.*\.(jsx|tsx|vue|svelte)$/,
    /^src\/.*\.(jsx|tsx|vue|svelte)$/,
  ],
  route: [
    /routes?\/.*\+page\.(svelte|js|ts)$/,
    /pages?\/.*\.(jsx|tsx|vue)$/,
    /app\/.*\/page\.(jsx|tsx)$/,
  ],
  api: [
    /api\/.*\.(js|ts)$/,
    /routes?\/.*\+server\.(js|ts)$/,
    /app\/api\/.*\/route\.(js|ts)$/,
  ],
  util: [
    /utils?\/.*\.(js|ts)$/,
    /helpers?\/.*\.(js|ts)$/,
    /lib\/.*\.(js|ts)$/,
  ],
  store: [
    /stores?\/.*\.(js|ts)$/,
    /state\/.*\.(js|ts)$/,
    /redux\/.*\.(js|ts)$/,
  ],
  type: [
    /types?\/.*\.(ts|d\.ts)$/,
    /interfaces?\/.*\.ts$/,
    /\.d\.ts$/,
  ],
  style: [
    /\.(css|scss|sass|less)$/,
    /styles?\/.*\.(css|scss|sass|less)$/,
  ],
};

// Framework detection patterns
const FRAMEWORK_PATTERNS = {
  sveltekit: ['svelte.config.js', 'svelte.config.ts', '.svelte-kit'],
  nextjs: ['next.config.js', 'next.config.ts', 'next.config.mjs'],
  nuxt: ['nuxt.config.js', 'nuxt.config.ts'],
  astro: ['astro.config.mjs', 'astro.config.ts'],
  vite: ['vite.config.js', 'vite.config.ts'],
  react: ['package.json'], // Check for react dependency
  vue: ['package.json'], // Check for vue dependency
  express: ['package.json'], // Check for express dependency
  fastapi: ['requirements.txt', 'pyproject.toml'], // Check for fastapi
  django: ['manage.py', 'settings.py'],
  flask: ['app.py', 'requirements.txt'],
};

/**
 * Get file list using git ls-files (fast) or fallback to fast-glob
 */
async function getFileList(rootPath, maxFiles) {
  // Try git ls-files first (much faster)
  const gitDir = join(rootPath, '.git');
  if (existsSync(gitDir)) {
    try {
      const output = execSync('git ls-files', {
        cwd: rootPath,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024, // 10MB
        timeout: 10000,
      });
      return output.trim().split('\n').filter(f => f).slice(0, maxFiles);
    } catch (e) {
      // Fall through to fast-glob
    }
  }

  // Fallback to fast-glob
  const allFiles = await fg('**/*', {
    cwd: rootPath,
    dot: true,
    onlyFiles: true,
    ignore: DEFAULT_IGNORES,
  });

  return allFiles.slice(0, maxFiles);
}

/**
 * Scan a directory and extract codebase information
 */
export async function scan(rootPath, options = {}) {
  const { verbose = false, maxFiles = 1000 } = options;

  // Get file list (git ls-files respects .gitignore, fast-glob uses DEFAULT_IGNORES)
  const files = await getFileList(rootPath, maxFiles);

  // Analyze files
  const result = {
    rootPath,
    files: [],
    languages: {},
    entryPoints: [],
    frameworks: [],
    structure: {},
    packageJson: null,
    commands: {},
  };

  // Detect frameworks first
  result.frameworks = await detectFrameworks(rootPath);

  // Load package.json if exists
  const pkgPath = join(rootPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      result.packageJson = JSON.parse(readFileSync(pkgPath, 'utf8'));
      result.commands = extractCommands(result.packageJson);
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Analyze each file
  for (const filePath of files) {
    const fullPath = join(rootPath, filePath);
    const analysis = analyzeFile(fullPath, filePath, rootPath);

    result.files.push(analysis);

    // Track languages
    if (analysis.language) {
      result.languages[analysis.language] = (result.languages[analysis.language] || 0) + 1;
    }

    // Track entry points
    if (analysis.isEntryPoint) {
      result.entryPoints.push(analysis);
    }

    // Build directory structure
    const dir = dirname(filePath);
    if (!result.structure[dir]) {
      result.structure[dir] = [];
    }
    result.structure[dir].push(analysis);
  }

  // Sort languages by count
  result.languages = Object.fromEntries(
    Object.entries(result.languages).sort((a, b) => b[1] - a[1])
  );

  return result;
}

/**
 * Analyze a single file
 */
function analyzeFile(fullPath, relativePath, rootPath) {
  const ext = extname(relativePath);
  const name = basename(relativePath);
  const language = LANGUAGE_MAP[ext] || null;

  const analysis = {
    path: relativePath,
    name,
    ext,
    language,
    purpose: classifyFile(relativePath),
    isEntryPoint: false,
    exports: [],
    imports: [],
    size: 0,
  };

  // Get file stats
  try {
    const stats = statSync(fullPath);
    analysis.size = stats.size;
  } catch (e) {
    // Ignore
  }

  // Only analyze source files (skip large files)
  if (analysis.size > 100000 || !language) {
    return analysis;
  }

  // Check for entry point patterns
  const entryPatterns = [
    'index.js', 'index.ts', 'main.js', 'main.ts',
    'app.js', 'app.ts', 'server.js', 'server.ts',
    '+page.svelte', '+page.ts', '+page.js',
    'page.tsx', 'page.jsx',
  ];
  analysis.isEntryPoint = entryPatterns.some(p => name === p || relativePath.endsWith(p));

  // Extract exports and imports only for entry point files
  // Skip content analysis for regular files to keep scanning fast
  if (analysis.isEntryPoint && ['javascript', 'typescript'].includes(language)) {
    try {
      const content = readFileSync(fullPath, 'utf8');
      analysis.exports = extractExports(content);
      analysis.imports = extractImports(content);
    } catch (e) {
      // Ignore read errors
    }
  }

  return analysis;
}

/**
 * Classify file by purpose
 */
function classifyFile(filePath) {
  for (const [purpose, patterns] of Object.entries(FILE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(filePath)) {
        return purpose;
      }
    }
  }
  return 'source';
}

/**
 * Extract exports from JS/TS content
 */
function extractExports(content) {
  const exports = [];

  // Named exports: export const/function/class name
  const namedExportRegex = /export\s+(?:const|let|var|function|class|async function)\s+(\w+)/g;
  let match;
  while ((match = namedExportRegex.exec(content)) !== null) {
    exports.push({ name: match[1], type: 'named' });
  }

  // Export { name1, name2 }
  const bracketExportRegex = /export\s*\{([^}]+)\}/g;
  while ((match = bracketExportRegex.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim());
    names.forEach(name => {
      if (name && !name.startsWith('//')) {
        exports.push({ name, type: 'named' });
      }
    });
  }

  // Default export
  if (/export\s+default/.test(content)) {
    exports.push({ name: 'default', type: 'default' });
  }

  return exports;
}

/**
 * Extract imports from JS/TS content
 */
function extractImports(content) {
  const imports = [];

  // import X from 'module'
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const module = match[1];
    if (!imports.includes(module)) {
      imports.push(module);
    }
  }

  // require('module')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    const module = match[1];
    if (!imports.includes(module)) {
      imports.push(module);
    }
  }

  return imports;
}

/**
 * Detect frameworks in use
 */
async function detectFrameworks(rootPath) {
  const frameworks = [];

  // Check for framework-specific files
  for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
    for (const pattern of patterns) {
      const filePath = join(rootPath, pattern);
      if (existsSync(filePath)) {
        // Special handling for package.json dependencies
        if (pattern === 'package.json') {
          try {
            const pkg = JSON.parse(readFileSync(filePath, 'utf8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };

            if (framework === 'react' && (deps.react || deps['react-dom'])) {
              frameworks.push('react');
            }
            if (framework === 'vue' && deps.vue) {
              frameworks.push('vue');
            }
            if (framework === 'express' && deps.express) {
              frameworks.push('express');
            }
          } catch (e) {
            // Ignore
          }
        } else {
          frameworks.push(framework);
        }
        break;
      }
    }
  }

  // Check Python frameworks
  const requirementsPath = join(rootPath, 'requirements.txt');
  if (existsSync(requirementsPath)) {
    const content = readFileSync(requirementsPath, 'utf8').toLowerCase();
    if (content.includes('fastapi')) frameworks.push('fastapi');
    if (content.includes('django')) frameworks.push('django');
    if (content.includes('flask')) frameworks.push('flask');
  }

  return [...new Set(frameworks)];
}

/**
 * Extract build/dev commands from package.json
 */
function extractCommands(pkg) {
  const commands = {};
  const scripts = pkg.scripts || {};

  // Map common script names
  const scriptMappings = {
    dev: ['dev', 'start:dev', 'serve', 'develop'],
    build: ['build', 'compile', 'dist'],
    test: ['test', 'test:unit', 'test:e2e', 'jest', 'vitest'],
    lint: ['lint', 'eslint', 'lint:fix'],
    format: ['format', 'prettier', 'fmt'],
    start: ['start', 'serve'],
  };

  for (const [command, scriptNames] of Object.entries(scriptMappings)) {
    for (const scriptName of scriptNames) {
      if (scripts[scriptName]) {
        commands[command] = `npm run ${scriptName}`;
        break;
      }
    }
  }

  return commands;
}
