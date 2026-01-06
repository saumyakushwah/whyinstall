import { existsSync } from 'fs';
import { join } from 'path';
import { PackageManager } from './types';

export function detectPackageManager(cwd: string = process.cwd()): PackageManager {
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (existsSync(join(cwd, 'yarn.lock'))) {
    return 'yarn';
  }
  if (existsSync(join(cwd, 'package-lock.json'))) {
    return 'npm';
  }
  return 'npm';
}

export function getLockFilePath(cwd: string, pm: PackageManager): string {
  const paths = {
    npm: 'package-lock.json',
    yarn: 'yarn.lock',
    pnpm: 'pnpm-lock.yaml'
  };
  return join(cwd, paths[pm]);
}
