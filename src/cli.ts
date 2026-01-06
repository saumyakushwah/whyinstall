#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { analyzePackage } from './analyzer';
import { formatOutput } from './formatter';
import { detectPackageManager } from './packageManager';

const program = new Command();

program
  .name('whyinstall')
  .description('Find why a dependency exists in your JS/TS project')
  .version('0.2.0')
  .argument('<package-name>', 'Package name to analyze')
  .option('-j, --json', 'Output as JSON')
  .option('-c, --cwd <path>', 'Working directory', process.cwd())
  .option('--impact', 'Show impact analysis for removing this dependency')
  .action((packageName: string, options: { json?: boolean; cwd?: string; impact?: boolean }) => {
    try {
      const cwd = options.cwd || process.cwd();
      const pm = detectPackageManager(cwd);
      
      if (!options.json) {
        console.log(`\n${chalk.gray(`Detected package manager: ${pm}`)}\n`);
      }
      
      const result = analyzePackage(packageName, cwd, options.impact);
      const output = formatOutput(result, options.json, options.impact);
      console.log(output);
      
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${message}`));
      process.exit(1);
    }
  });

program.parse();
