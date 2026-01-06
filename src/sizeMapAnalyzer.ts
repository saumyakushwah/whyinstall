import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';
import { SizeMapResult, SizeBreakdown } from './types';

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
}

const JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);
const EXCLUDE_DIRS = new Set(['test', 'tests', '__tests__', 'docs', 'doc', 'types', '@types', 'typings', '.d.ts']);

function readPackageJson(path: string): PackageJson | null {
  try {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8'));
    }
  } catch {}
  return null;
}

function shouldExclude(name: string): boolean {
  const lower = name.toLowerCase();
  return EXCLUDE_DIRS.has(lower) || lower.endsWith('.d.ts') || lower.startsWith('.');
}

function calculateJsSize(dir: string): number {
  let total = 0;
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (shouldExclude(entry)) continue;
      const fullPath = join(dir, entry);
      try {
        const stats = statSync(fullPath);
        if (stats.isDirectory()) {
          if (entry !== 'node_modules') {
            total += calculateJsSize(fullPath);
          }
        } else if (JS_EXTENSIONS.has(extname(entry).toLowerCase())) {
          total += stats.size;
        }
      } catch {}
    }
  } catch {}
  return total;
}

function getNodeModulesSize(cwd: string): number {
  const nmPath = join(cwd, 'node_modules');
  let total = 0;
  
  function walkDir(dir: string): void {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        try {
          const stats = statSync(fullPath);
          if (stats.isDirectory()) {
            walkDir(fullPath);
          } else if (JS_EXTENSIONS.has(extname(entry).toLowerCase())) {
            total += stats.size;
          }
        } catch {}
      }
    } catch {}
  }
  
  walkDir(nmPath);
  return total;
}

function findPackagePath(packageName: string, cwd: string): string | null {
  const directPath = join(cwd, 'node_modules', packageName);
  if (existsSync(directPath)) return directPath;
  
  // Handle scoped packages
  if (packageName.startsWith('@')) {
    const parts = packageName.split('/');
    const scopedPath = join(cwd, 'node_modules', parts[0], parts[1]);
    if (existsSync(scopedPath)) return scopedPath;
  }
  return null;
}

function getDependencyTree(packagePath: string, cwd: string, visited: Set<string> = new Set()): SizeBreakdown[] {
  const breakdown: SizeBreakdown[] = [];
  const pkgJsonPath = join(packagePath, 'package.json');
  const pkg = readPackageJson(pkgJsonPath);
  
  if (!pkg?.dependencies) return breakdown;
  
  for (const depName of Object.keys(pkg.dependencies)) {
    if (visited.has(depName)) continue;
    visited.add(depName);
    
    // Check nested node_modules first
    let depPath = join(packagePath, 'node_modules', depName);
    if (!existsSync(depPath)) {
      depPath = join(cwd, 'node_modules', depName);
    }
    
    if (existsSync(depPath)) {
      const size = calculateJsSize(depPath);
      if (size > 0) {
        breakdown.push({ name: depName, size });
      }
      // Recursively get sub-dependencies
      const subDeps = getDependencyTree(depPath, cwd, visited);
      breakdown.push(...subDeps);
    }
  }
  
  return breakdown;
}

export function analyzeSizeMap(packageName: string, cwd: string = process.cwd()): SizeMapResult {
  const packagePath = findPackagePath(packageName, cwd);
  if (!packagePath) {
    throw new Error(`Package "${packageName}" not found in node_modules`);
  }
  
  const ownSize = calculateJsSize(packagePath);
  const visited = new Set<string>([packageName]);
  const depBreakdown = getDependencyTree(packagePath, cwd, visited);
  
  const breakdown: SizeBreakdown[] = [
    { name: packageName, size: ownSize },
    ...depBreakdown.sort((a, b) => b.size - a.size)
  ];
  
  const totalSize = breakdown.reduce((sum, item) => sum + item.size, 0);
  const nodeModulesSize = getNodeModulesSize(cwd);
  const percentOfNodeModules = nodeModulesSize > 0 ? (totalSize / nodeModulesSize) * 100 : 0;
  
  return {
    packageName,
    totalSize,
    breakdown,
    nodeModulesSize,
    percentOfNodeModules
  };
}

