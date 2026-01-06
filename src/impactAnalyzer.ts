import { ImpactAnalysis } from './types';
import { FileUsage, findSourceFiles, analyzeFileUsage } from './fileFinder';

function analyzeUsageContext(usage: FileUsage, content: string): string {
  // Analyze actual usage patterns in THIS codebase, not generic assumptions
  const lines = content.split('\n');
  const contextLines: string[] = [];
  
  // Get context around usage lines
  usage.lines.forEach(lineNum => {
    const start = Math.max(0, lineNum - 2);
    const end = Math.min(lines.length, lineNum + 2);
    contextLines.push(...lines.slice(start, end));
  });
  
  const context = contextLines.join('\n').toLowerCase();
  
  // Simple heuristics based on actual code patterns, not package names
  if (context.includes('console.') || context.includes('process.stdout') || context.includes('process.stderr')) {
    return 'Console/output';
  }
  
  if (context.includes('response') || context.includes('res.') || context.includes('req.')) {
    return 'HTTP/API';
  }
  
  if (context.includes('database') || context.includes('db.') || context.includes('query')) {
    return 'Database';
  }
  
  if (context.includes('test') || context.includes('spec') || context.includes('describe')) {
    return 'Testing';
  }
  
  return 'General usage';
}

function computeRiskLevel(files: FileUsage[], contexts: string[]): 'Low' | 'Medium' | 'High' {
  // Risk assessment based on WHERE it's used, not WHAT package it is
  const hasDatabase = contexts.some(c => c === 'Database');
  const hasHTTP = contexts.some(c => c === 'HTTP/API');
  const hasTesting = contexts.every(c => c === 'Testing');
  const hasConsole = contexts.every(c => c === 'Console/output');
  
  // High risk: Database, HTTP/API (core functionality)
  if (hasDatabase || hasHTTP) {
    return 'High';
  }
  
  // Low risk: Only in tests, or only console output
  if (hasTesting || (hasConsole && files.length === 1)) {
    return 'Low';
  }
  
  // Medium: Everything else (could be important, needs review)
  return 'Medium';
}

function generateImpacts(files: FileUsage[], contexts: string[], packageName: string): string[] {
  const impacts: string[] = [];
  const uniqueContexts = [...new Set(contexts)];
  
  // Base impacts on actual usage in THIS codebase
  if (files.length === 0) {
    impacts.push(`No direct usage found in source files`);
    impacts.push(`May be a transitive dependency or unused`);
  } else {
    const totalMethods = new Set(files.flatMap(f => f.methods));
    
    if (totalMethods.size > 0) {
      impacts.push(`Methods used: ${Array.from(totalMethods).slice(0, 8).join(', ')}${totalMethods.size > 8 ? ` (+${totalMethods.size - 8} more)` : ''}`);
    } else {
      impacts.push(`Package imported but no method calls detected`);
      impacts.push(`May be used as default export or namespace`);
    }
    
    impacts.push(`Used in ${files.length} file${files.length !== 1 ? 's' : ''}: ${uniqueContexts.join(', ')}`);
    
    // Context-specific guidance (based on actual usage, not package name)
    if (uniqueContexts.includes('Database')) {
      impacts.push(`⚠️  Used in database operations - removal may break data access`);
    }
    
    if (uniqueContexts.includes('HTTP/API')) {
      impacts.push(`⚠️  Used in API/HTTP layer - removal may break endpoints`);
    }
    
    if (uniqueContexts.includes('Testing')) {
      impacts.push(`✓ Only used in tests - safe to remove from production dependencies`);
    }
    
    if (uniqueContexts.includes('Console/output') && files.length === 1) {
      impacts.push(`✓ Only used for console output - low impact, can be replaced`);
    }
  }
  
  impacts.push(`\n💡 Review the files above to assess actual impact in your codebase`);
  
  return impacts;
}

export function analyzeImpact(packageName: string, cwd: string): ImpactAnalysis {
  const sourceFiles = findSourceFiles(cwd);
  const fileUsages: FileUsage[] = [];
  
  for (const file of sourceFiles) {
    const usage = analyzeFileUsage(file, packageName, cwd);
    if (usage) {
      fileUsages.push(usage);
    }
  }
  
  // Analyze actual usage context in THIS codebase
  const contexts = fileUsages.map(usage => {
    try {
      const fs = require('fs');
      const path = require('path');
      const fullPath = usage.file.startsWith(cwd) ? usage.file : path.join(cwd, usage.file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      return analyzeUsageContext(usage, content);
    } catch {
      return 'Unknown';
    }
  });
  
  const riskLevel = computeRiskLevel(fileUsages, contexts);
  const impacts = generateImpacts(fileUsages, contexts, packageName);
  
  // Add contexts to file usages
  fileUsages.forEach((usage, index) => {
    (usage as any).purpose = contexts[index];
  });
  
  return {
    files: fileUsages,
    riskLevel,
    impacts
  };
}
