import Handlebars from 'handlebars';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { classify, groupBySuit } from './k-route.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Register Handlebars helpers
Handlebars.registerHelper('join', function(array, separator) {
  if (!Array.isArray(array)) return '';
  return array.join(separator);
});

Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
  return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
});

/**
 * Load and compile a template
 */
function loadTemplate(name) {
  const templatePath = join(__dirname, 'templates', `${name}.hbs`);
  const templateContent = readFileSync(templatePath, 'utf8');
  return Handlebars.compile(templateContent);
}

/**
 * Generate context files from scan result
 */
export async function generate(scanResult, options = {}) {
  const {
    outputDir = '.',
    force = false,
  } = options;

  // Prepare template data
  const data = prepareTemplateData(scanResult);

  // Generate CLAUDE.md
  const claudeMdPath = join(outputDir, 'CLAUDE.md');
  if (!existsSync(claudeMdPath) || force) {
    const claudeTemplate = loadTemplate('CLAUDE.md');
    const claudeContent = claudeTemplate(data);
    writeFileSync(claudeMdPath, claudeContent, 'utf8');
  }

  // Generate .cursor/rules/project-context.mdc
  const cursorDir = join(outputDir, '.cursor', 'rules');
  if (!existsSync(cursorDir)) {
    mkdirSync(cursorDir, { recursive: true });
  }

  const cursorRulePath = join(cursorDir, 'project-context.mdc');
  if (!existsSync(cursorRulePath) || force) {
    const cursorTemplate = loadTemplate('cursor-rule.mdc');
    const cursorContent = cursorTemplate(data);
    writeFileSync(cursorRulePath, cursorContent, 'utf8');
  }

  // Write metadata for status checks
  const metadataPath = join(outputDir, '.k-context.json');
  const metadata = {
    version: '0.1.0',
    generatedAt: new Date().toISOString(),
    fileCount: scanResult.files.length,
    checksum: computeChecksum(scanResult),
  };
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

  return {
    claudeMd: claudeMdPath,
    cursorRule: cursorRulePath,
    metadata: metadataPath,
  };
}

/**
 * Prepare data for templates
 */
function prepareTemplateData(scanResult) {
  const {
    files,
    languages,
    frameworks,
    entryPoints,
    structure,
    packageJson,
    commands,
  } = scanResult;

  // Classify files with K-vectors
  const classifiedFiles = files.map(file => ({
    ...file,
    kVector: classify(file.path),
  }));

  // Group by domain
  const byDomain = {
    hearts: classifiedFiles.filter(f => f.kVector.suit === 'hearts').slice(0, 10),
    spades: classifiedFiles.filter(f => f.kVector.suit === 'spades').slice(0, 10),
    diamonds: classifiedFiles.filter(f => f.kVector.suit === 'diamonds').slice(0, 10),
    clubs: classifiedFiles.filter(f => f.kVector.suit === 'clubs').slice(0, 10),
  };

  // Determine primary language
  const languageEntries = Object.entries(languages);
  const primaryLanguage = languageEntries.length > 0 ? languageEntries[0][0] : 'unknown';

  // Detect file patterns
  const patterns = detectPatterns(files);

  // Extract conventions from code
  const conventions = detectConventions(scanResult);

  // Identify key files
  const keyFiles = identifyKeyFiles(files, entryPoints);

  // Prepare structure (limit depth and count)
  const limitedStructure = {};
  const structureEntries = Object.entries(structure);
  for (const [dir, dirFiles] of structureEntries.slice(0, 15)) {
    if (dir !== '.') {
      limitedStructure[dir] = dirFiles.slice(0, 5);
    }
  }

  return {
    packageJson: packageJson || { name: 'project', version: '0.0.0' },
    languages,
    frameworks,
    primaryLanguage,
    entryPoints: entryPoints.slice(0, 10),
    structure: limitedStructure,
    commands,
    byDomain,
    patterns,
    conventions,
    keyFiles,
    globs: '**/*',
  };
}

/**
 * Detect file patterns in the codebase
 */
function detectPatterns(files) {
  const patterns = {};

  // Component patterns
  const componentFiles = files.filter(f =>
    f.path.includes('component') ||
    f.path.endsWith('.vue') ||
    f.path.endsWith('.svelte') ||
    (f.path.endsWith('.tsx') && !f.path.includes('page'))
  );
  if (componentFiles.length > 0) {
    patterns.components = detectCommonPattern(componentFiles);
  }

  // Route patterns
  const routeFiles = files.filter(f =>
    f.path.includes('route') ||
    f.path.includes('page') ||
    f.path.includes('+page')
  );
  if (routeFiles.length > 0) {
    patterns.routes = detectCommonPattern(routeFiles);
  }

  // API patterns
  const apiFiles = files.filter(f =>
    f.path.includes('api/') ||
    f.path.includes('+server')
  );
  if (apiFiles.length > 0) {
    patterns.api = detectCommonPattern(apiFiles);
  }

  // Test patterns
  const testFiles = files.filter(f =>
    f.path.includes('.test.') ||
    f.path.includes('.spec.') ||
    f.path.includes('__tests__')
  );
  if (testFiles.length > 0) {
    patterns.tests = detectCommonPattern(testFiles);
  }

  // Style patterns
  const styleFiles = files.filter(f =>
    f.ext === '.css' ||
    f.ext === '.scss' ||
    f.ext === '.sass'
  );
  if (styleFiles.length > 0) {
    patterns.styles = detectCommonPattern(styleFiles);
  }

  return patterns;
}

/**
 * Detect common glob pattern for a set of files
 */
function detectCommonPattern(files) {
  if (files.length === 0) return '';

  // Find common prefix
  const paths = files.map(f => f.path);
  const firstPath = paths[0];
  let commonPrefix = '';

  for (let i = 0; i < firstPath.length; i++) {
    const char = firstPath[i];
    if (paths.every(p => p[i] === char)) {
      commonPrefix += char;
    } else {
      break;
    }
  }

  // Find common suffix (extension)
  const extensions = [...new Set(files.map(f => f.ext))];
  const extPattern = extensions.length === 1 ? `*${extensions[0]}` : `*.{${extensions.join(',')}}`;

  // Build glob pattern
  if (commonPrefix.includes('/')) {
    const dir = commonPrefix.substring(0, commonPrefix.lastIndexOf('/') + 1);
    return `${dir}**/${extPattern}`;
  }

  return `**/${extPattern}`;
}

/**
 * Detect coding conventions from the codebase
 */
function detectConventions(scanResult) {
  const conventions = [];
  const { files, frameworks, packageJson } = scanResult;

  // Framework-specific conventions
  if (frameworks.includes('sveltekit')) {
    conventions.push('Use Svelte 5 runes syntax ($state, $derived, $effect)');
    conventions.push('Routes in src/routes/ with +page.svelte convention');
  }

  if (frameworks.includes('nextjs')) {
    conventions.push('App Router in app/ directory');
    conventions.push('Server components by default, "use client" for client components');
  }

  if (frameworks.includes('react')) {
    conventions.push('Functional components with hooks');
  }

  // TypeScript detection
  const hasTypeScript = files.some(f => f.ext === '.ts' || f.ext === '.tsx');
  if (hasTypeScript) {
    conventions.push('TypeScript for type safety');
  }

  // Test framework detection
  if (packageJson?.devDependencies?.vitest || packageJson?.devDependencies?.jest) {
    conventions.push('Write tests for new features');
  }

  // ESLint/Prettier detection
  const hasEslint = files.some(f => f.name.includes('eslint'));
  const hasPrettier = files.some(f => f.name.includes('prettier'));
  if (hasEslint) {
    conventions.push('Follow ESLint rules');
  }
  if (hasPrettier) {
    conventions.push('Format code with Prettier');
  }

  // Tailwind detection
  if (packageJson?.devDependencies?.tailwindcss || packageJson?.dependencies?.tailwindcss) {
    conventions.push('Use Tailwind CSS for styling');
  }

  return conventions;
}

/**
 * Identify key files for documentation
 */
function identifyKeyFiles(files, entryPoints) {
  const keyFiles = [];

  // Add entry points
  for (const ep of entryPoints.slice(0, 5)) {
    keyFiles.push({
      path: ep.path,
      description: ep.purpose || 'Entry point',
    });
  }

  // Add config files
  const configFiles = files.filter(f => f.purpose === 'config').slice(0, 5);
  for (const cf of configFiles) {
    keyFiles.push({
      path: cf.path,
      description: 'Configuration',
    });
  }

  return keyFiles;
}

/**
 * Compute checksum for staleness detection
 */
function computeChecksum(scanResult) {
  const { files } = scanResult;
  const paths = files.map(f => `${f.path}:${f.size}`).sort();
  // Simple hash - in production use proper hash
  return paths.join('|').length.toString(16);
}

/**
 * Check if context files are up to date
 */
export async function checkStatus(scanResult, outputDir) {
  const metadataPath = join(outputDir, '.k-context.json');

  if (!existsSync(metadataPath)) {
    return {
      upToDate: false,
      changes: ['No metadata found - run k-context init'],
    };
  }

  try {
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
    const currentChecksum = computeChecksum(scanResult);

    if (metadata.checksum !== currentChecksum) {
      const changes = [];

      if (metadata.fileCount !== scanResult.files.length) {
        changes.push(`File count changed: ${metadata.fileCount} → ${scanResult.files.length}`);
      }

      // Find changed files by comparing modification times
      const claudeMdPath = join(outputDir, 'CLAUDE.md');
      if (existsSync(claudeMdPath)) {
        const claudeMdMtime = statSync(claudeMdPath).mtime;
        const newerFiles = scanResult.files.filter(f => {
          try {
            const fullPath = join(scanResult.rootPath, f.path);
            const fileMtime = statSync(fullPath).mtime;
            return fileMtime > claudeMdMtime;
          } catch {
            return false;
          }
        });

        for (const f of newerFiles.slice(0, 10)) {
          changes.push(`Modified: ${f.path}`);
        }
      }

      return {
        upToDate: false,
        changes,
      };
    }

    return {
      upToDate: true,
      changes: [],
    };
  } catch (err) {
    return {
      upToDate: false,
      changes: [`Error reading metadata: ${err.message}`],
    };
  }
}
