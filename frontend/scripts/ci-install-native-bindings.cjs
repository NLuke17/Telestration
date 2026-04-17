#!/usr/bin/env node
/**
 * Rollup, lightningcss, @tailwindcss/oxide, esbuild, etc. ship platform-specific optional deps.
 * When package-lock.json was generated on macOS, `npm ci` on Linux can omit Linux bindings
 * (https://github.com/npm/cli/issues/4828). Install the correct optional packages after npm ci.
 *
 * IMPORTANT: Install all missing natives in ONE `npm install` invocation. Separate installs can
 * prune optional deps from each other ("removed 1 package").
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

/** Rollup optionalDependency keys: @rollup/rollup-linux-x64-gnu, etc. */
function rollupLinuxOptionalKey() {
  const { platform, arch } = process;
  if (platform !== 'linux') return null;
  const musl = isMusl();
  if (arch === 'x64') return musl ? '@rollup/rollup-linux-x64-musl' : '@rollup/rollup-linux-x64-gnu';
  if (arch === 'arm64') return musl ? '@rollup/rollup-linux-arm64-musl' : '@rollup/rollup-linux-arm64-gnu';
  return null;
}

/** lightningcss optionalDependency keys: lightningcss-linux-x64-gnu, etc. */
function lightningcssLinuxOptionalKey() {
  const { platform, arch } = process;
  if (platform !== 'linux') return null;
  const musl = isMusl();
  if (arch === 'x64') return musl ? 'lightningcss-linux-x64-musl' : 'lightningcss-linux-x64-gnu';
  if (arch === 'arm64') return musl ? 'lightningcss-linux-arm64-musl' : 'lightningcss-linux-arm64-gnu';
  return null;
}

/** @tailwindcss/oxide optionalDependency keys (Tailwind v4 native engine). */
function tailwindOxideLinuxOptionalKey() {
  const { platform, arch } = process;
  if (platform !== 'linux') return null;
  const musl = isMusl();
  if (arch === 'x64') return musl ? '@tailwindcss/oxide-linux-x64-musl' : '@tailwindcss/oxide-linux-x64-gnu';
  if (arch === 'arm64') return musl ? '@tailwindcss/oxide-linux-arm64-musl' : '@tailwindcss/oxide-linux-arm64-gnu';
  return null;
}

/** esbuild optionalDependency keys (@esbuild/linux-x64 — single package per arch). */
function esbuildLinuxOptionalKey() {
  const { platform, arch } = process;
  if (platform !== 'linux') return null;
  if (arch === 'x64') return '@esbuild/linux-x64';
  if (arch === 'arm64') return '@esbuild/linux-arm64';
  return null;
}

function optionalPackageJsonPath(optionalKey) {
  const parts = optionalKey.split('/');
  if (parts.length >= 2 && parts[0].startsWith('@')) {
    return path.join(frontendRoot, 'node_modules', parts[0], parts[1], 'package.json');
  }
  return path.join(frontendRoot, 'node_modules', optionalKey, 'package.json');
}

/** @param {string[]} nodeModulesSegments e.g. ['rollup'] or ['@tailwindcss','oxide'] */
function collectMissing(nodeModulesSegments, resolveOptionalKey, label) {
  const pkgJsonPath = path.join(frontendRoot, 'node_modules', ...nodeModulesSegments, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    console.warn(`[ci-install-native-bindings] skip ${label}: ${nodeModulesSegments.join('/')} not installed`);
    return [];
  }

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const optionalDeps = pkgJson.optionalDependencies || {};
  const optionalKey = resolveOptionalKey();

  if (!optionalKey) {
    console.log(`[ci-install-native-bindings] skip ${label} (not linux x64/arm64 CI runner)`);
    return [];
  }

  const ver = optionalDeps[optionalKey];
  if (!ver) {
    console.error(`[ci-install-native-bindings] no optionalDependencies entry for ${optionalKey} in ${label}`);
    process.exit(1);
  }

  const installedMarker = optionalPackageJsonPath(optionalKey);
  if (fs.existsSync(installedMarker)) {
    console.log(`[ci-install-native-bindings] ${optionalKey} already present (${label})`);
    return [];
  }

  console.log(`[ci-install-native-bindings] will add ${optionalKey}@${ver} (${label})`);
  return [`${optionalKey}@${ver}`];
}

const specs = [
  ...collectMissing(['rollup'], rollupLinuxOptionalKey, 'rollup'),
  ...collectMissing(['lightningcss'], lightningcssLinuxOptionalKey, 'lightningcss'),
  ...collectMissing(['@tailwindcss', 'oxide'], tailwindOxideLinuxOptionalKey, '@tailwindcss/oxide'),
  ...collectMissing(['esbuild'], esbuildLinuxOptionalKey, 'esbuild'),
];

if (specs.length === 0) {
  process.exit(0);
}

console.log('[ci-install-native-bindings] single npm install (keeps all optional natives)', specs.join(' '));
const quoted = specs.map((s) => `"${s}"`).join(' ');
execSync(`npm install ${quoted} --no-save`, { stdio: 'inherit', cwd: frontendRoot });
