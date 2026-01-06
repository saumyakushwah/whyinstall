import chalk from 'chalk';
import { AnalyzeResult, DependencyPath, SizeMapResult } from './types';

function formatSize(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatChain(chain: string[], isLast: boolean): string {
  if (chain.length === 0) return '';
  
  const parts: string[] = [];
  
  for (let i = 0; i < chain.length; i++) {
    const isLastInChain = i === chain.length - 1;
    let prefix: string;
    let indent = '';
    
    if (i === 0) {
      prefix = '';
      indent = '   ';
    } else {
      indent = '   ' + ' '.repeat((i - 1) * 3);
      if (isLastInChain) {
        prefix = '└─> ';
      } else {
        prefix = '├─> ';
      }
    }
    
    let packageName = chain[i];
    if (packageName.includes('node_modules/')) {
      packageName = chalk.gray(packageName.replace(/.*node_modules\//, 'node_modules/'));
    } else if (packageName.includes('/')) {
      packageName = chalk.white(packageName);
    } else {
      packageName = chalk.cyan(packageName);
    }
    
    parts.push(`${indent}${prefix}${packageName}`);
  }
  
  return parts.join('\n');
}

function getTypeLabel(type: DependencyPath['type']): string {
  const labels = {
    prod: chalk.green('prod'),
    dev: chalk.yellow('dev'),
    peer: chalk.blue('peer'),
    optional: chalk.gray('optional')
  };
  return labels[type] || type;
}

export function formatOutput(result: AnalyzeResult, json: boolean = false): string {
  if (json) {
    return JSON.stringify(result, null, 2);
  }
  
  const { package: pkg, suggestions } = result;
  const sizeStr = pkg.size ? formatSize(pkg.size) : '';
  const sizeDisplay = sizeStr ? ` (${sizeStr})` : '';
  
  let output = '';
  output += chalk.bold.cyan(`${pkg.name}`) + chalk.gray(` v${pkg.version}`) + chalk.dim(`${sizeDisplay}`) + '\n';
  if (pkg.description) {
    output += chalk.white(`  ${pkg.description}\n`);
  }
  output += '\n' + chalk.dim(`  installed via ${pkg.paths.length} path${pkg.paths.length !== 1 ? 's' : ''}\n\n`);
  
  if (pkg.paths.length === 0) {
    output += chalk.yellow('  No dependency paths found.\n');
  } else {
    pkg.paths.forEach((path, index) => {
      const pathNum = chalk.gray(`${index + 1}.`);
      const typeLabel = getTypeLabel(path.type);
      
      let chainDisplay = path.chain.length > 0 ? path.chain : [pkg.name];
      
      output += `${pathNum} ${typeLabel}\n`;
      output += formatChain(chainDisplay, index === pkg.paths.length - 1);
      output += '\n';
    });
  }
  
  if (pkg.sourceFiles && pkg.sourceFiles.length > 0) {
    output += '\n' + chalk.bold(`Used in (${pkg.sourceFiles.length}):`) + '\n';
    pkg.sourceFiles.forEach((file) => {
      output += `  ${chalk.blue(file)}\n`;
    });
  }
  
  if (suggestions.length > 0) {
    output += '\n' + chalk.bold('Suggested actions:') + '\n';
    suggestions.forEach((suggestion, index) => {
      output += `  ${index + 1}. ${chalk.gray(suggestion)}\n`;
    });
  }
  
  return output;
}

export function formatSizeMap(result: SizeMapResult, json: boolean = false): string {
  if (json) {
    return JSON.stringify(result, null, 2);
  }

  let output = '';
  output += chalk.bold.cyan(`Size map for: ${result.packageName}\n\n`);
  output += chalk.bold(`${result.packageName} total impact: `) + chalk.green(formatSize(result.totalSize)) + '\n\n';
  output += chalk.bold('Breakdown:\n');

  for (const item of result.breakdown) {
    const sizeStr = formatSize(item.size);
    output += chalk.gray('- ') + chalk.white(item.name) + chalk.gray(': ') + chalk.yellow(sizeStr) + '\n';
  }

  if (result.percentOfNodeModules !== undefined && result.percentOfNodeModules > 0) {
    output += '\n' + chalk.dim(`This package contributes ${result.percentOfNodeModules.toFixed(1)}% of your vendor bundle.\n`);
  }

  return output;
}
