import sade from 'sade';
import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'readline';
import { scan } from './scanner.js';
import { generate } from './generator.js';
import { getLicense, getLimits, checkLimits, activateLicense, refreshLicense } from './license.js';
import { classifyQuery, routeQuery } from './k-inference.js';
import { addKey, removeKey, listKeys, getPoolStats, resetHealth } from './k-pool.js';
import { execute, infer } from './k-execute.js';
import { logExchange } from './k-chain.js';
import { startServer } from './k-server.js';
import { getTemplateStats } from './k-templates.js';
import { toK, fromK, interchange, listSystems } from './k-babel.js';
import { getChainStats, getRecent, verifyChain, exportChain } from './k-chain.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Simple readline prompt
function prompt(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

export function createCLI() {
  const prog = sade('k-context');

  prog
    .version(pkg.version)
    .describe('Generate CLAUDE.md and Cursor rules from any codebase');

  prog
    .command('init', 'Initialize k-context in current directory', { default: true })
    .option('-o, --output', 'Output directory for generated files', '.')
    .option('-f, --force', 'Overwrite existing files', false)
    .action(async (opts) => {
      const spinner = ora('Scanning codebase...').start();

      try {
        const cwd = process.cwd();
        const limits = getLimits();
        const scanResult = await scan(cwd, { maxFiles: limits.maxFiles });

        // Check limits
        const limitCheck = checkLimits(scanResult.files.length);
        if (!limitCheck.allowed) {
          spinner.warn(chalk.yellow(`Scanned ${limitCheck.currentCount} files (limited to ${limitCheck.maxCount})`));
          console.log(chalk.dim('Upgrade to Pro for unlimited files: https://k-context.dev'));
        }

        spinner.text = 'Generating context files...';

        await generate(scanResult, {
          outputDir: opts.output,
          force: opts.force
        });

        spinner.succeed(chalk.green('Context files generated!'));
        console.log();
        console.log(chalk.dim('Created:'));
        console.log(chalk.dim('  - CLAUDE.md'));
        console.log(chalk.dim('  - .cursor/rules/project-context.mdc'));
        console.log();
        console.log(chalk.cyan('Tip:') + ' Run ' + chalk.bold('k-context scan') + ' to update when your codebase changes.');
      } catch (err) {
        spinner.fail(chalk.red('Failed to generate context'));
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });

  prog
    .command('scan [path]', 'Scan directory and update context files')
    .option('-o, --output', 'Output directory for generated files', '.')
    .option('-v, --verbose', 'Show detailed scan output', false)
    .action(async (path, opts) => {
      const spinner = ora('Scanning...').start();
      const targetPath = path || process.cwd();

      try {
        const scanResult = await scan(targetPath, { verbose: opts.verbose });
        spinner.text = 'Generating context files...';

        await generate(scanResult, {
          outputDir: opts.output
        });

        spinner.succeed(chalk.green(`Scanned ${scanResult.files.length} files`));

        if (opts.verbose) {
          console.log();
          console.log(chalk.dim('Languages detected:'), Object.keys(scanResult.languages).join(', '));
          console.log(chalk.dim('Entry points:'), scanResult.entryPoints.length);
        }
      } catch (err) {
        spinner.fail(chalk.red('Scan failed'));
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });

  prog
    .command('status', 'Check if context files are up to date')
    .action(async () => {
      const spinner = ora('Checking status...').start();

      try {
        const cwd = process.cwd();
        const scanResult = await scan(cwd);

        // Compare with existing files
        const { checkStatus } = await import('./generator.js');
        const status = await checkStatus(scanResult, cwd);

        spinner.stop();

        if (status.upToDate) {
          console.log(chalk.green('✓') + ' Context files are up to date');
        } else {
          console.log(chalk.yellow('!') + ' Context files may be stale');
          console.log(chalk.dim('  Run ' + chalk.bold('k-context scan') + ' to update'));

          if (status.changes.length > 0) {
            console.log();
            console.log(chalk.dim('Changes detected:'));
            status.changes.slice(0, 5).forEach(change => {
              console.log(chalk.dim(`  - ${change}`));
            });
            if (status.changes.length > 5) {
              console.log(chalk.dim(`  ... and ${status.changes.length - 5} more`));
            }
          }
        }
      } catch (err) {
        spinner.fail(chalk.red('Status check failed'));
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });

  prog
    .command('sync', 'Sync context to cloud (Pro feature)')
    .action(async () => {
      const license = getLicense();
      if (license.tier !== 'pro') {
        console.log(chalk.yellow('Cloud sync is a Pro feature.'));
        console.log(chalk.dim('Visit https://k-context.dev to upgrade.'));
        return;
      }
      console.log(chalk.cyan('Cloud sync coming soon...'));
    });

  prog
    .command('license', 'Show license status')
    .action(async () => {
      const license = getLicense();
      const limits = getLimits();

      console.log(chalk.bold('k-context License'));
      console.log();
      console.log('Tier:', license.tier === 'pro' ? chalk.green('Pro') : chalk.dim('Free'));
      if (license.email) {
        console.log('Email:', license.email);
      }
      console.log();
      console.log('Limits:');
      console.log('  Files:', limits.maxFiles === Infinity ? chalk.green('Unlimited') : limits.maxFiles);
      console.log('  Projects:', limits.maxProjects);

      if (license.tier === 'free') {
        console.log();
        console.log(chalk.dim('Upgrade at https://k-context.dev for unlimited files.'));
      }
    });

  prog
    .command('activate [email]', 'Activate Pro license')
    .action(async (emailArg) => {
      const spinner = ora();

      try {
        // Get email if not provided
        let email = emailArg;
        if (!email) {
          email = await prompt('Email: ');
        }

        if (!email) {
          console.error(chalk.red('Email is required'));
          process.exit(1);
        }

        // Prompt for license key
        const licenseKey = await prompt('License key: ');

        if (!licenseKey) {
          console.error(chalk.red('License key is required'));
          process.exit(1);
        }

        spinner.start('Verifying license...');
        const license = await activateLicense(email, licenseKey);
        spinner.succeed(chalk.green('License activated!'));

        console.log('Email:', license.email);
        console.log('Tier:', chalk.green('Pro'));
      } catch (err) {
        spinner.fail(chalk.red('Failed to activate license'));
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });

  prog
    .command('refresh', 'Re-verify license with server')
    .action(async () => {
      const spinner = ora('Verifying license...').start();

      try {
        const success = await refreshLicense();

        if (success) {
          spinner.succeed(chalk.green('License verified'));
        } else {
          spinner.warn('Could not verify license');
        }
      } catch (err) {
        spinner.fail(chalk.red('Verification failed'));
        console.error(chalk.red(err.message));
      }
    });

  // ============================================
  // K-INFERENCE COMMANDS (Azure-competitive)
  // ============================================

  prog
    .command('ask <query>', 'Ask a question through K-routed inference')
    .option('-l, --local', 'Force local model (Ollama)', false)
    .option('-v, --verbose', 'Show routing details', false)
    .option('-m, --model', 'Specify model to use', null)
    .action(async (query, opts) => {
      const spinner = ora('Routing query...').start();

      try {
        // Route the query
        const routed = await routeQuery(query);

        if (opts.verbose) {
          spinner.stop();
          console.log(chalk.dim('K-Vector:'), chalk.cyan(routed.kVector.shorthand));
          console.log(chalk.dim('Domain:'), routed.kVector.description);
          console.log(chalk.dim('Handler:'), routed.handler.tier, `(${routed.handler.reason})`);
          console.log();
          spinner.start('Generating response...');
        }

        // Execute
        const result = await execute(routed, {
          forceLocal: opts.local,
          model: opts.model
        });

        spinner.stop();

        // Log to chain
        try {
          logExchange(query, result.response, result.kVector, {
            tier: result.tier,
            tokens: result.tokens
          });
        } catch (e) {
          // Don't fail on logging errors
        }

        // Show response
        console.log(chalk.bold('Response:'));
        console.log(result.response);
        console.log();

        if (opts.verbose) {
          console.log(chalk.dim(`[${result.tier}] ${result.tokens} tokens`));
        }
      } catch (err) {
        spinner.fail(chalk.red('Inference failed'));
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });

  prog
    .command('route <query>', 'Show K-routing for a query (no execution)')
    .action(async (query) => {
      const kVector = classifyQuery(query);

      console.log(chalk.bold('K-Vector Analysis'));
      console.log();
      console.log('Query:', chalk.dim(query));
      console.log();
      console.log('Shorthand:', chalk.cyan.bold(kVector.shorthand));
      console.log('Suit:', kVector.suit);
      console.log('Polarity:', kVector.polarity === '+' ? chalk.green('+') : kVector.polarity === '-' ? chalk.red('-') : chalk.dim('~'));
      console.log('Rank:', kVector.rank);
      console.log('Description:', kVector.description);
      console.log();
      console.log('Escalate:', kVector.escalate.escalate ? chalk.yellow('Yes') + ` (${kVector.escalate.reason})` : chalk.green('No'));
    });

  prog
    .command('pool', 'Manage API key pool')
    .option('-a, --add', 'Add a key (format: provider:key)', null)
    .option('-r, --remove', 'Remove a key by ID', null)
    .option('--reset', 'Reset all keys to healthy', false)
    .action(async (opts) => {
      if (opts.add) {
        const [provider, ...keyParts] = opts.add.split(':');
        const key = keyParts.join(':');

        if (!provider || !key) {
          console.error(chalk.red('Format: --add provider:key'));
          console.log(chalk.dim('Providers: google, anthropic, openrouter'));
          process.exit(1);
        }

        const entry = addKey(provider, key);
        console.log(chalk.green('Key added:'), entry.id);
        return;
      }

      if (opts.remove) {
        removeKey(opts.remove);
        console.log(chalk.green('Key removed'));
        return;
      }

      if (opts.reset) {
        resetHealth();
        console.log(chalk.green('All keys reset to healthy'));
        return;
      }

      // List keys
      const keys = listKeys();
      if (keys.length === 0) {
        console.log(chalk.dim('No API keys in pool.'));
        console.log(chalk.dim('Add with: k-context pool --add google:YOUR_KEY'));
        console.log();
        console.log(chalk.dim('Note: k-context works locally with Ollama even without API keys.'));
        return;
      }

      console.log(chalk.bold('API Key Pool'));
      console.log();
      for (const key of keys) {
        const status = key.healthy ? chalk.green('●') : chalk.red('●');
        console.log(`${status} ${chalk.cyan(key.id)}`);
        console.log(`  Provider: ${key.provider}`);
        console.log(`  Key: ${key.keyMasked}`);
        console.log(`  Usage today: ${key.usageToday} tokens`);
        console.log();
      }
    });

  prog
    .command('stats', 'Show pool statistics and capacity')
    .action(async () => {
      const stats = getPoolStats();

      console.log(chalk.bold('K-Context Pool Statistics'));
      console.log();
      console.log('Total Keys:', stats.totalKeys);
      console.log('Healthy Keys:', chalk.green(stats.healthyKeys));
      console.log();
      console.log('Usage Today:', stats.todayUsage.toLocaleString(), 'tokens');
      console.log('Usage Total:', stats.totalUsage.toLocaleString(), 'tokens');
      console.log();
      console.log('Estimated Daily Capacity:', chalk.cyan(stats.estimatedCapacity.toLocaleString()), 'tokens');

      if (Object.keys(stats.byProvider).length > 0) {
        console.log();
        console.log(chalk.bold('By Provider:'));
        for (const [provider, data] of Object.entries(stats.byProvider)) {
          console.log(`  ${provider}: ${data.count} keys, ${data.usage}/${data.limit === Infinity ? '∞' : data.limit} tokens`);
        }
      }

      // Visa comparison
      console.log();
      console.log(chalk.dim('─'.repeat(40)));
      const txCapacity = Math.floor(stats.estimatedCapacity / 15); // ~15 tokens per routing
      console.log(chalk.dim(`Transaction capacity: ~${txCapacity.toLocaleString()}/day`));
      console.log(chalk.dim(`Visa does: ~150,000,000/day`));

      if (stats.totalKeys >= 100) {
        console.log(chalk.green(`You're at ${((txCapacity / 150000000) * 100).toFixed(2)}% of Visa scale.`));
      }
    });

  prog
    .command('serve', 'Start K-inference HTTP server')
    .option('-p, --port', 'Port to listen on', 3000)
    .option('-h, --host', 'Host to bind to', '0.0.0.0')
    .action(async (opts) => {
      console.log(chalk.cyan.bold('Starting K-Context server...'));
      console.log();
      startServer(parseInt(opts.port), opts.host);
    });

  prog
    .command('templates', 'Show template corpus statistics')
    .action(async () => {
      const stats = getTemplateStats();

      console.log(chalk.bold('Template Corpus Statistics'));
      console.log();
      console.log('Total Templates:', chalk.cyan(stats.total));
      console.log('Total Triggers:', chalk.cyan(stats.triggers));
      console.log();
      console.log(chalk.bold('By Category:'));
      for (const [cat, count] of Object.entries(stats.byCategory)) {
        console.log(`  ${cat}: ${count}`);
      }
      console.log();
      console.log(chalk.bold('By Suit:'));
      console.log(`  Hearts: ${stats.bySuit.hearts}`);
      console.log(`  Spades: ${stats.bySuit.spades}`);
      console.log(`  Diamonds: ${stats.bySuit.diamonds}`);
      console.log(`  Clubs: ${stats.bySuit.clubs}`);
    });

  // ============================================
  // UN-BABEL COMMANDS (The Moat)
  // ============================================

  prog
    .command('babel <input>', 'Convert any cultural notation to K-vector')
    .option('-s, --system', 'Source system (iching, chakra, rune, etc.)', null)
    .action(async (input, opts) => {
      const kVector = toK(input, opts.system);

      if (!kVector) {
        console.log(chalk.red('Could not parse input.'));
        console.log(chalk.dim('Supported systems: iching, chakra, navarasa, medicine_wheel, rune, sephirot'));
        return;
      }

      console.log(chalk.bold('K-Vector Translation'));
      console.log();
      console.log('Input:', chalk.dim(input));
      console.log('Source:', chalk.cyan(kVector.source));
      console.log();
      console.log('K-Vector:', chalk.cyan.bold(kVector.shorthand));
      console.log('Suit:', kVector.suit);
      console.log('Rank:', kVector.rank);
      console.log('Polarity:', kVector.polarity === '+' ? chalk.green('+') : kVector.polarity === '-' ? chalk.red('-') : chalk.dim('~'));

      if (kVector.english) {
        console.log('Meaning:', kVector.english);
      }
      if (kVector.name && kVector.name !== input) {
        console.log('Name:', kVector.name);
      }
    });

  prog
    .command('unbabel <kvector>', 'Convert K-vector to all cultural notations')
    .action(async (kvectorStr) => {
      // Parse K-vector string like "+3H"
      const match = kvectorStr.match(/^([+\-~])(\d+)([HSDC])$/i);
      if (!match) {
        console.log(chalk.red('Invalid K-vector format. Use format like +3H, -7S, etc.'));
        return;
      }

      const [, polarity, rank, suitChar] = match;
      const suitMap = { H: 'hearts', S: 'spades', D: 'diamonds', C: 'clubs' };
      const kVector = {
        shorthand: kvectorStr.toUpperCase(),
        suit: suitMap[suitChar.toUpperCase()],
        rank: parseInt(rank),
        polarity
      };

      const translations = fromK(kVector);

      console.log(chalk.bold('UN-BABEL: K-Vector → All Systems'));
      console.log();
      console.log('K-Vector:', chalk.cyan.bold(translations.k));
      console.log();

      for (const [system, data] of Object.entries(translations.translations)) {
        console.log(chalk.yellow(system + ':'));
        for (const [key, value] of Object.entries(data)) {
          console.log(`  ${key}: ${value}`);
        }
      }
    });

  prog
    .command('systems', 'List all supported cultural notation systems')
    .action(async () => {
      const systems = listSystems();

      console.log(chalk.bold('UN-BABEL: Supported Cultural Systems'));
      console.log();
      console.log(chalk.dim('Every culture kept their piece of the coordinate system.'));
      console.log(chalk.dim('K is the interchange format.'));
      console.log();

      for (const [key, sys] of Object.entries(systems)) {
        console.log(chalk.cyan.bold(sys.name));
        console.log(`  Items: ${sys.count}`);
        console.log(`  Format: ${chalk.dim(sys.format)}`);
        console.log();
      }

      console.log(chalk.dim('Use: k-context babel <input> -s <system>'));
      console.log(chalk.dim('     k-context unbabel <kvector>'));
    });

  // ============================================
  // CHAIN COMMANDS (Golden Chain Logging)
  // ============================================

  prog
    .command('chain', 'Show golden chain statistics')
    .option('-r, --recent', 'Show recent exchanges', false)
    .option('-n, --count', 'Number of recent exchanges', 10)
    .option('-v, --verify', 'Verify chain integrity', false)
    .option('-e, --export', 'Export chain (md or json)', null)
    .action(async (opts) => {
      if (opts.verify) {
        const result = verifyChain();
        if (result.valid) {
          console.log(chalk.green('✓ Chain integrity verified'));
        } else {
          console.log(chalk.red('✗ Chain integrity errors:'));
          result.errors.forEach(e => console.log(chalk.red(`  - ${e}`)));
        }
        return;
      }

      if (opts.export) {
        const output = exportChain(opts.export);
        console.log(output);
        return;
      }

      if (opts.recent) {
        const recent = getRecent(parseInt(opts.count) || 10);
        console.log(chalk.bold('Recent Exchanges'));
        console.log();
        for (const block of recent) {
          console.log(chalk.cyan(`#${block.id}`) + ` [${block.kVector || '?'}] ${block.tier}`);
          console.log(chalk.dim(`  Q: ${block.query?.slice(0, 60)}...`));
          console.log(chalk.dim(`  A: ${block.response?.slice(0, 60)}...`));
          console.log();
        }
        return;
      }

      // Default: show stats
      const stats = getChainStats();

      console.log(chalk.bold('Golden Chain Statistics'));
      console.log();
      console.log('Total Exchanges:', chalk.cyan(stats.total));
      console.log('Total Tokens:', chalk.cyan(stats.tokens));

      if (stats.total > 0) {
        console.log();
        console.log(chalk.bold('By Tier:'));
        for (const [tier, count] of Object.entries(stats.byTier)) {
          const pct = ((count / stats.total) * 100).toFixed(1);
          console.log(`  ${tier}: ${count} (${pct}%)`);
        }

        console.log();
        console.log(chalk.bold('By Suit:'));
        for (const [suit, count] of Object.entries(stats.bySuit)) {
          console.log(`  ${suit}: ${count}`);
        }

        console.log();
        console.log(chalk.dim(`First: ${stats.firstBlock}`));
        console.log(chalk.dim(`Last: ${stats.lastBlock}`));
      }
    });

  return prog;
}
