/**
 * Patch unicorn-magic package.json so Node ESM resolver can resolve the package root.
 * The package only had exports["node"] and exports["default"]; Node expects exports["."].
 * Without ".", Node 18+ throws ERR_PACKAGE_PATH_NOT_EXPORTED when Appium (via tsx) loads it.
 * Patch all copies under node_modules (top-level and nested in appium-*-driver).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const nodeModules = path.join(root, 'node_modules');
if (!fs.existsSync(nodeModules)) {
  process.exit(0);
}

function patchOne(pkgPath) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.exports = {
    '.': {
      types: './node.d.ts',
      import: './node.js',
      default: './node.js',
    },
  };
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

try {
  const out = execSync(
    'find . -path "*/unicorn-magic/package.json"',
    { cwd: nodeModules, encoding: 'utf8', maxBuffer: 1024 * 1024 }
  );
  for (const rel of out.trim().split('\n').filter(Boolean)) {
    patchOne(path.join(nodeModules, rel));
  }
} catch (_) {
  // find may fail if no matches; ignore
}
