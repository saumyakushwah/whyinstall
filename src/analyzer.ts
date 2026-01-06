import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { PackageInfo, DependencyPath, AnalyzeResult } from './types';
import { detectPackageManager } from './packageManager';
import { findFilesUsingPackage } from './fileFinder';
import { analyzeImpact } from './impactAnalyzer';

interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

function readPackageJson(path: string): PackageJson | null {
  try {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return null;
}

function findPackageJsonPath(packageName: string, cwd: string): string | null {
  try {
    const resolved = require.resolve(`${packageName}/package.json`, { paths: [cwd] });
    return resolved;
  } catch {
    const nodeModulesPath = join(cwd, 'node_modules', packageName, 'package.json');
    if (existsSync(nodeModulesPath)) {
      return nodeModulesPath;
    }
    return null;
  }
}

function findPackageInNodeModules(packageName: string, basePath: string): string | null {
  const possiblePaths = [
    join(basePath, 'node_modules', packageName, 'package.json'),
    join(basePath, packageName, 'package.json')
  ];
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  
  const parent = dirname(basePath);
  if (parent !== basePath && parent !== '/') {
    return findPackageInNodeModules(packageName, parent);
  }
  
  return null;
}

function findPackageSize(packagePath: string): number | undefined {
  try {
    const stats = statSync(packagePath);
    if (stats.isDirectory()) {
      let totalSize = 0;
      const files = readdirSync(packagePath);
      for (const file of files) {
        const filePath = join(packagePath, file);
        try {
          const fileStats = statSync(filePath);
          if (fileStats.isDirectory()) {
            const subSize = findPackageSize(filePath);
            if (subSize) totalSize += subSize;
          } else {
            totalSize += fileStats.size;
          }
        } catch {
          // ignore
        }
      }
      return totalSize;
    }
  } catch {
    // ignore
  }
  return undefined;
}

function getAllDependencies(pkg: PackageJson): Record<string, 'prod' | 'dev' | 'peer' | 'optional'> {
  const deps: Record<string, 'prod' | 'dev' | 'peer' | 'optional'> = {};
  
  if (pkg.dependencies) {
    for (const name of Object.keys(pkg.dependencies)) {
      deps[name] = 'prod';
    }
  }
  if (pkg.devDependencies) {
    for (const name of Object.keys(pkg.devDependencies)) {
      deps[name] = 'dev';
    }
  }
  if (pkg.peerDependencies) {
    for (const name of Object.keys(pkg.peerDependencies)) {
      deps[name] = 'peer';
    }
  }
  if (pkg.optionalDependencies) {
    for (const name of Object.keys(pkg.optionalDependencies)) {
      deps[name] = 'optional';
    }
  }
  
  return deps;
}

function findDependencyPaths(
  targetPackage: string,
  cwd: string,
  maxDepth: number = 10
): DependencyPath[] {
  const paths: DependencyPath[] = [];
  const visited = new Set<string>();
  
  interface QueueItem {
    packageName: string;
    chain: string[];
    packageJsonPath: string;
  }
  
  const rootPackageJson = join(cwd, 'package.json');
  if (!existsSync(rootPackageJson)) {
    return [];
  }
  
  const queue: QueueItem[] = [{ packageName: '', chain: [], packageJsonPath: rootPackageJson }];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (current.chain.length > maxDepth) {
      continue;
    }
    
    const pkg = readPackageJson(current.packageJsonPath);
    if (!pkg) {
      continue;
    }
    
    const allDeps = getAllDependencies(pkg);
    const currentPackageName = current.packageName || pkg.name || '';
    
    const visitKey = `${currentPackageName}:${current.packageJsonPath}`;
    if (visited.has(visitKey)) {
      continue;
    }
    visited.add(visitKey);
    
    for (const [depName, depType] of Object.entries(allDeps)) {
      if (depName === targetPackage) {
        const chain = currentPackageName 
          ? (current.chain.length > 0 ? [...current.chain, currentPackageName, depName] : [currentPackageName, depName])
          : [depName];
        paths.push({
          chain,
          type: depType,
          packageJsonPath: current.packageJsonPath
        });
      } else {
        const depPackageJsonPath = findPackageInNodeModules(depName, dirname(current.packageJsonPath));
        if (depPackageJsonPath) {
          const newChain = currentPackageName 
            ? (current.chain.length > 0 ? [...current.chain, currentPackageName] : [currentPackageName])
            : [];
          queue.push({
            packageName: depName,
            chain: newChain,
            packageJsonPath: depPackageJsonPath
          });
        }
      }
    }
  }
  
  return paths;
}

function formatSize(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function analyzePackage(packageName: string, cwd: string = process.cwd(), includeImpact: boolean = false): AnalyzeResult {
  const rootPackageJson = join(cwd, 'package.json');
  const packageJsonPath = findPackageJsonPath(packageName, cwd);
  if (!packageJsonPath) {
    throw new Error(`Package "${packageName}" not found in node_modules`);
  }
  
  const packageDir = dirname(packageJsonPath);
  const pkg = readPackageJson(packageJsonPath);
  const version = pkg?.version || 'unknown';
  const description = pkg?.description;
  
  const size = findPackageSize(packageDir);
  
  let paths = findDependencyPaths(packageName, cwd);
  
  // Deduplicate paths with same chain and type
  const pathKeys = new Set<string>();
  paths = paths.filter(path => {
    const key = `${path.type}:${path.chain.join('->')}`;
    if (pathKeys.has(key)) {
      return false;
    }
    pathKeys.add(key);
    return true;
  });
  
  const suggestions: string[] = [];
  
  if (paths.length === 0) {
    suggestions.push(`Package "${packageName}" is not in dependency tree`);
  } else {
    const devPaths = paths.filter(p => p.type === 'dev');
    const peerPaths = paths.filter(p => p.type === 'peer');
    
    if (devPaths.length > 0) {
      suggestions.push(`Consider removing from devDependencies if not needed for development`);
    }
    if (peerPaths.length > 0) {
      suggestions.push(`This is a peer dependency - ensure all consumers satisfy the peer requirement`);
    }
    
    const directDeps = paths.filter(p => p.chain.length === 1 && p.packageJsonPath === rootPackageJson);
    if (directDeps.length > 0 && paths.length > directDeps.length) {
      suggestions.push(`Can be removed from direct dependencies - it's installed transitively`);
    }
  }
  
  const sourceFiles = findFilesUsingPackage(packageName, cwd);
  
  let impact;
  if (includeImpact) {
    impact = analyzeImpact(packageName, cwd);
  }
  
  return {
    package: {
      name: packageName,
      version,
      description,
      size,
      paths,
      sourceFiles: sourceFiles.length > 0 ? sourceFiles : undefined,
      impact
    },
    suggestions
  };
}
