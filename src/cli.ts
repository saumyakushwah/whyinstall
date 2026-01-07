#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { analyzePackage } from './analyzer';
import { formatOutput, formatSizeMap } from './formatter';
import { detectPackageManager } from './packageManager';
import { analyzeSizeMap } from './sizeMapAnalyzer';

const program = new Command();

program
  .name('whyinstall')
  .description('Find why a dependency exists in your JS/TS project')
  .version('0.3.2')
  .argument('<package-name>', 'Package name to analyze')
  .option('-j, --json', 'Output as JSON')
  .option('-c, --cwd <path>', 'Working directory', process.cwd())
  .option('-s, --size-map', 'Show bundle size impact breakdown')
  .action((packageName: string, options: { json?: boolean; cwd?: string; sizeMap?: boolean }) => {
    try {
      const cwd = options.cwd || process.cwd();
      const pm = detectPackageManager(cwd);
      
      if (!options.json) {
        console.log(`\n${chalk.gray(`Detected package manager: ${pm}`)}\n`);
      }
      
      if (options.sizeMap) {
        const result = analyzeSizeMap(packageName, cwd);
        const output = formatSizeMap(result, options.json);
        console.log(output);
      } else {
        const result = analyzePackage(packageName, cwd);
        const output = formatOutput(result, options.json);
        console.log(output);
      }
      
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${message}`));
      process.exit(1);
    }
  });

program.parse();
