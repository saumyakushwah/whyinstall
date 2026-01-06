import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];

function shouldIgnoreDir(dirName: string): boolean {
  return IGNORE_DIRS.includes(dirName) || dirName.startsWith('.');
}

function isSourceFile(filePath: string): boolean {
  return SOURCE_EXTENSIONS.includes(extname(filePath));
}

export function findSourceFiles(dir: string, maxDepth: number = 5, currentDepth: number = 0): string[] {
  if (currentDepth > maxDepth) {
    return [];
  }

  const files: string[] = [];

  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      
      try {
        const stats = statSync(fullPath);
        
        if (stats.isDirectory()) {
          if (!shouldIgnoreDir(entry)) {
            files.push(...findSourceFiles(fullPath, maxDepth, currentDepth + 1));
          }
        } else if (stats.isFile() && isSourceFile(fullPath)) {
          files.push(fullPath);
        }
      } catch {
        // ignore errors for individual files/dirs
      }
    }
  } catch {
    // ignore errors
  }

  return files;
}

export interface FileUsage {
  file: string;
  lines: number[];
  methods: string[];
  context?: string[];
  purpose?: string;
}

function fileContainsPackage(filePath: string, packageName: string): boolean {
  try {
    const content = readFileSync(filePath, 'utf-8');
    
    const patterns = [
      new RegExp(`require\\(['"]${packageName}(/.*)?['"]\\)`, 'g'),
      new RegExp(`from\\s+['"]${packageName}(/.*)?['"]`, 'g'),
      new RegExp(`import\\s+.*\\s+from\\s+['"]${packageName}(/.*)?['"]`, 'g'),
      new RegExp(`import\\s+['"]${packageName}(/.*)?['"]`, 'g'),
    ];
    
    return patterns.some(pattern => pattern.test(content));
  } catch {
    return false;
  }
}

export function analyzeFileUsage(filePath: string, packageName: string, cwd: string): FileUsage | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = filePath.replace(cwd + '/', '');
    
    const importPatterns = [
      new RegExp(`require\\(['"]${packageName}(/.*)?['"]\\)`, 'g'),
      new RegExp(`from\\s+['"]${packageName}(/.*)?['"]`, 'g'),
      new RegExp(`import\\s+.*\\s+from\\s+['"]${packageName}(/.*)?['"]`, 'g'),
      new RegExp(`import\\s+['"]${packageName}(/.*)?['"]`, 'g'),
    ];
    
    const usageLines: number[] = [];
    const methods = new Set<string>();
    const context: string[] = [];
    
    // Find import lines
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      if (importPatterns.some(pattern => pattern.test(line))) {
        usageLines.push(lineNum);
      }
    });
    
    // Find method usage patterns:
    const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // 1. Direct: packageName.method() or packageName.method
    const directMethodPattern = new RegExp('\\b' + escapedPackageName + '\\.(\\w+)', 'g');
    const directMatches = content.matchAll(directMethodPattern);
    for (const match of directMatches) {
      methods.add(match[1]);
    }
    
    // 2. Destructured imports: const { red, bold } = require('chalk')
    const destructurePattern = new RegExp('(?:const|let|var)\\s*\\{[^}]*\\}\\s*=\\s*(?:require|import)\\s*\\(?[\'"]' + escapedPackageName, 'g');
    if (destructurePattern.test(content)) {
      const destructureMatch = content.match(/(?:const|let|var)\s*\{([^}]+)\}/);
      if (destructureMatch) {
        destructureMatch[1].split(',').forEach(m => {
          const method = m.trim().split(':')[0].trim();
          if (method) methods.add(method);
        });
      }
    }
    
    // 3. Default import assigned to variable: const program = new Command(); program.method()
    // Find named imports: import { Command } from 'commander'
    const namedImportMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/i);
    if (namedImportMatch && namedImportMatch[2] === packageName) {
      const namedImports = namedImportMatch[1].split(',').map(i => i.trim().split('as')[0].trim());
      namedImports.forEach(importName => {
        // Find instances: const program = new Command()
        const escapedImportName = importName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const instancePattern = new RegExp('(?:const|let|var)\\s+([A-Za-z_$][A-Za-z0-9_$]*)\\s*=\\s*new\\s+' + escapedImportName, 'g');
        const instanceMatches = content.matchAll(instancePattern);
        for (const instanceMatch of instanceMatches) {
          const instanceName = instanceMatch[1];
          // Find methods on this instance: program.command()
          const instanceMethodPattern = new RegExp('\\b' + instanceName + '\\.(\\w+)\\s*\\(', 'g');
          const methodMatches = content.matchAll(instanceMethodPattern);
          for (const methodMatch of methodMatches) {
            methods.add(methodMatch[1]);
          }
        }
      });
    }
    
    // 4. Default import: import Command from 'commander' or const Command = require('commander')
    const defaultImportMatch = content.match(new RegExp('(?:import|const|let|var)\\s+([A-Za-z_$][A-Za-z0-9_$]*)\\s*(?:=|from)\\s*[\'"]' + escapedPackageName, 'i'));
    if (defaultImportMatch) {
      const importedName = defaultImportMatch[1];
      // Find all method calls on this imported name: program.method()
      const instanceMethodPattern = new RegExp('\\b' + importedName + '\\.(\\w+)\\s*\\(', 'g');
      const instanceMatches = content.matchAll(instanceMethodPattern);
      for (const match of instanceMatches) {
        methods.add(match[1]);
      }
    }
    
    // Capture context (lines around usage)
    if (usageLines.length > 0) {
      const firstLine = Math.max(0, usageLines[0] - 3);
      const lastLine = Math.min(lines.length, usageLines[usageLines.length - 1] + 3);
      context.push(...lines.slice(firstLine, lastLine));
    }
    
    if (usageLines.length > 0) {
      return {
        file: relativePath,
        lines: usageLines,
        methods: Array.from(methods),
        context: context.slice(0, 10) // Limit context
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

export function findFilesUsingPackage(packageName: string, cwd: string): string[] {
  const sourceFiles = findSourceFiles(cwd);
  const matchingFiles: string[] = [];
  
  for (const file of sourceFiles) {
    if (fileContainsPackage(file, packageName)) {
      const relativePath = file.replace(cwd + '/', '');
      matchingFiles.push(relativePath);
    }
  }
  
  return matchingFiles;
}
