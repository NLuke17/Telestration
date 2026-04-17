#!/usr/bin/env node
/**
 * Rollup 4+ loads a platform-specific optional dependency (e.g. @rollup/rollup-linux-x64-gnu).
 * npm ci can skip installing the Linux binding when the lockfile was generated on another OS
 * (see https://github.com/npm/cli/issues/4828). GitHub Actions runs Linux — ensure the matching
 * optional package is present after npm ci.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const frontendRoot = path.join(__dirname, '..');
const rollupPkgPath = path.join(frontendRoot, 'node_modules', 'rollup', 'package.json');
if (!fs.existsSync(rollupPkgPath)) {
  console.error('[ci-install-rollup-native] rollup is not installed (run npm ci first).');
  process.exit(1);
}

const rollupJson = JSON.parse(fs.readFileSync(rollupPkgPath, 'utf8'));
const opt = rollupJson.optionalDependencies || {};

function isMusl() {
  try {
    return !require('node:process').report.getReport().header.glibcVersionRuntime;
  } catch {
    return false;
  }
}

/** Matches rollup/dist/native.js bindings for linux (gnu vs musl). */
function nativeBindingPackageName() {
  const { platform, arch } = process;
  if (platform === 'linux') {
    const musl = isMusl();
    if (arch === 'x64') return musl ? '@rollup/rollup-linux-x64-musl' : '@rollup/rollup-linux-x64-gnu';
    if (arch === 'arm64') return musl ? '@rollup/rollup-linux-arm64-musl' : '@rollup/rollup-linux-arm64-gnu';
  }
  return null;
}

const pkgName = nativeBindingPackageName();
if (!pkgName) {
  console.log('[ci-install-rollup-native] skipping (not linux x64/arm64 CI runner)');
  process.exit(0);
}

const ver = opt[pkgName];
if (!ver) {
  console.error(`[ci-install-rollup-native] no optionalDependencies entry for ${pkgName} in rollup`);
  process.exit(1);
}

const installedMarker = path.join(frontendRoot, 'node_modules', pkgName, 'package.json');
if (fs.existsSync(installedMarker)) {
  console.log(`[ci-install-rollup-native] ${pkgName} already installed`);
  process.exit(0);
}

console.log(`[ci-install-rollup-native] installing ${pkgName}@${ver} (npm optional-deps workaround)`);
execSync(`npm install "${pkgName}@${ver}" --no-save`, { stdio: 'inherit', cwd: frontendRoot });
