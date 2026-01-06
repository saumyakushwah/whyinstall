export interface DependencyPath {
  chain: string[];
  type: 'prod' | 'dev' | 'peer' | 'optional';
  packageJsonPath?: string;
}

export interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  size?: number;
  paths: DependencyPath[];
  sourceFiles?: string[];
}

export interface AnalyzeResult {
  package: PackageInfo;
  suggestions: string[];
}

export type PackageManager = 'npm' | 'yarn' | 'pnpm';

export interface SizeBreakdown {
  name: string;
  size: number;
}

export interface SizeMapResult {
  packageName: string;
  totalSize: number;
  breakdown: SizeBreakdown[];
  nodeModulesSize?: number;
  percentOfNodeModules?: number;
}
