export interface DependencyPath {
  chain: string[];
  type: 'prod' | 'dev' | 'peer' | 'optional';
  packageJsonPath?: string;
}

export interface FileUsage {
  file: string;
  lines: number[];
  methods: string[];
  context?: string[];
  purpose?: string;
}

export interface ImpactAnalysis {
  files: FileUsage[];
  riskLevel: 'Low' | 'Medium' | 'High';
  impacts: string[];
}

export interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  size?: number;
  paths: DependencyPath[];
  sourceFiles?: string[];
  impact?: ImpactAnalysis;
}

export interface AnalyzeResult {
  package: PackageInfo;
  suggestions: string[];
}

export type PackageManager = 'npm' | 'yarn' | 'pnpm';
