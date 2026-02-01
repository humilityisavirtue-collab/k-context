import sade from 'sade';
import chalk from 'chalk';
import ora from 'ora';
import { scan } from './scanner.js';
import { generate } from './generator.js';
import { getLicense, getLimits, checkLimits, activateLicense } from './license.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
    .command('activate <email> <key>', 'Activate Pro license')
    .action(async (email, key) => {
      try {
        const license = activateLicense(email, key);
        console.log(chalk.green('License activated!'));
        console.log('Email:', license.email);
        console.log('Tier:', chalk.green('Pro'));
      } catch (err) {
        console.error(chalk.red('Failed to activate license:'), err.message);
        process.exit(1);
      }
    });

  return prog;
}
