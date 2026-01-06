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
