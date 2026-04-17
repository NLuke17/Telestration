#!/usr/bin/env node
/**
 * Rollup, lightningcss (Tailwind), and similar packages ship platform-specific optional dependencies.
 * When package-lock.json was generated on macOS, `npm ci` on Linux can omit the Linux binding
 * (https://github.com/npm/cli/issues/4828). Install the correct optional package for this OS after npm ci.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const frontendRoot = path.join(__dirname, '..');

function isMusl() {
  try {
    return !require('node:process').report.getReport().header.glibcVersionRuntime;
  } catch {
    return false;
  }
}

/** Rollup optionalDependency keys match @rollup/rollup-* */
function rollupLinuxOptionalKey() {
  const { platform, arch } = process;
  if (platform !== 'linux') return null;
  const musl = isMusl();
  if (arch === 'x64') return musl ? '@rollup/rollup-linux-x64-musl' : '@rollup/rollup-linux-x64-gnu';
  if (arch === 'arm64') return musl ? '@rollup/rollup-linux-arm64-musl' : '@rollup/rollup-linux-arm64-gnu';
  return null;
}

/** lightningcss optionalDependency keys are lightningcss-linux-x64-gnu etc. */
function lightningcssLinuxOptionalKey() {
  const { platform, arch } = process;
  if (platform !== 'linux') return null;
  const musl = isMusl();
  if (arch === 'x64') return musl ? 'lightningcss-linux-x64-musl' : 'lightningcss-linux-x64-gnu';
  if (arch === 'arm64') return musl ? 'lightningcss-linux-arm64-musl' : 'lightningcss-linux-arm64-gnu';
  return null;
}

function optionalPackageJsonPath(optionalKey) {
  const parts = optionalKey.split('/');
  if (parts.length >= 2 && parts[0].startsWith('@')) {
    return path.join(frontendRoot, 'node_modules', parts[0], parts[1], 'package.json');
  }
  return path.join(frontendRoot, 'node_modules', optionalKey, 'package.json');
}

function ensureBinding(parentPkgFolderName, resolveOptionalKey, label) {
  const pkgJsonPath = path.join(frontendRoot, 'node_modules', parentPkgFolderName, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    console.warn(`[ci-install-native-bindings] skip ${label}: ${parentPkgFolderName} not installed`);
    return;
  }

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const optionalDeps = pkgJson.optionalDependencies || {};
  const optionalKey = resolveOptionalKey();

  if (!optionalKey) {
    console.log(`[ci-install-native-bindings] skip ${label} (not linux x64/arm64 CI runner)`);
    return;
  }

  const ver = optionalDeps[optionalKey];
  if (!ver) {
    console.error(`[ci-install-native-bindings] no optionalDependencies entry for ${optionalKey} in ${parentPkgFolderName}`);
    process.exit(1);
  }

  const installedMarker = optionalPackageJsonPath(optionalKey);

  if (fs.existsSync(installedMarker)) {
    console.log(`[ci-install-native-bindings] ${optionalKey} already installed (${label})`);
    return;
  }

  console.log(`[ci-install-native-bindings] installing ${optionalKey}@${ver} (${label}, npm optional-deps workaround)`);
  execSync(`npm install "${optionalKey}@${ver}" --no-save`, { stdio: 'inherit', cwd: frontendRoot });
}

ensureBinding('rollup', rollupLinuxOptionalKey, 'rollup');
ensureBinding('lightningcss', lightningcssLinuxOptionalKey, 'lightningcss');
