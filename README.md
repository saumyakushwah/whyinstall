# whyinstall

CLI tool to find why a dependency exists in your JS/TS project. Works with npm, yarn, and pnpm.

## Installation

```bash
npm install -g whyinstall
```

Or use with npx:

```bash
npx whyinstall <package-name>
```

## Usage

```bash
whyinstall lodash
```

### Options

- `-j, --json` - Output results as JSON
- `-c, --cwd <path>` - Set working directory (default: current directory)
- `-s, --size-map` - Show bundle size impact breakdown

## Features

- Works with npm, Yarn, and pnpm (auto-detection)
- Shows dependency chains for any package
- Displays dependency type (prod, dev, peer, optional)
- Shows package description, version, and size
- Finds source files that actually use the package
- Colored tree output for readability
- JSON output for CI/CD
- Actionable suggestions for optimization
- Bundle size impact breakdown

## Example Output

```bash
whyinstall chalk
```

```
chalk v5.3.0 (43 KB)
  Terminal string styling done right

  installed via 1 path

1. prod
   whyinstall
   └─> chalk

Used in (2):
  src/cli.ts
  src/formatter.ts

Suggested actions:
  1. Can be removed from direct dependencies - it's installed transitively
```

### Size Map Output

```bash
whyinstall next --size-map
```

```
Size map for: next

next total impact: 66.69 MB

Breakdown:
- next: 63.08 MB
- caniuse-lite: 2.19 MB
- styled-jsx: 971 KB
- @swc/helpers: 190 KB
- source-map-js: 104 KB
- postcss: 101 KB
- tslib: 60 KB
- nanoid: 20 KB
- @next/env: 10 KB
- picocolors: 3 KB
- client-only: 144 B

This package contributes 44.7% of your vendor bundle.
```

## Development

```bash
npm install
npm run build
npm link
```

## License

MIT
