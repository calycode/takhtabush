import { spawn, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { freePort } from './port.mjs';

/**
 * Playwright webServer entry point: build the SPA, reset the throwaway local
 * database, apply migrations, then hand the port to `wrangler dev`.
 */
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageDir, '..', '..');
const stateDir = path.join(packageDir, '.state');
const port = process.env.E2E_PORT ?? '8788';
const configPath = path.join(repoRoot, 'wrangler.dev.jsonc');
const wranglerBin = path.join(repoRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const baseUrl = `http://127.0.0.1:${port}`;

if (!existsSync(wranglerBin)) {
   console.error(`[e2e] wrangler not found at ${wranglerBin}. Run pnpm install first.`);
   process.exit(1);
}

function run(label, command, args, options = {}) {
   console.log(`[e2e] ${label}`);
   const result = spawnSync(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      ...options,
   });
   if (result.error) {
      console.error(`[e2e] ${label} failed: ${result.error.message}`);
      process.exit(1);
   }
   if (result.status !== 0) {
      console.error(`[e2e] ${label} exited with code ${result.status}`);
      process.exit(result.status ?? 1);
   }
}

if (!(await freePort())) {
   console.error(`[e2e] ${baseUrl} is not available. Stop the process using it or set E2E_PORT.`);
   process.exit(process.exitCode ?? 1);
}

if (process.env.E2E_SKIP_BUILD !== '1') {
   // pnpm resolves to a .cmd shim on Windows, which needs a shell there.
   run('Building the webapp', 'pnpm', ['--filter', '@caly/webapp', 'build'], {
      shell: process.platform === 'win32',
   });
}

rmSync(stateDir, { recursive: true, force: true });
run('Applying local migrations', process.execPath, [
   wranglerBin,
   'd1',
   'migrations',
   'apply',
   'DB',
   '--local',
   '--persist-to',
   stateDir,
   '--config',
   configPath,
]);

const worker = spawn(
   process.execPath,
   [
      wranglerBin,
      'dev',
      '--config',
      configPath,
      '--ip',
      '127.0.0.1',
      '--port',
      port,
      '--local',
      '--persist-to',
      stateDir,
      // The dev magic link is built from APP_URL. Tests read the token from the
      // API response, but keeping the link correct keeps the UI path honest.
      '--var',
      `APP_URL:${baseUrl}`,
      '--log-level',
      'warn',
   ],
   { cwd: repoRoot, stdio: 'inherit' },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
   process.on(signal, () => worker.kill(signal));
}

worker.on('exit', (code) => process.exit(code ?? 0));
worker.on('error', (cause) => {
   console.error(`[e2e] failed to start wrangler: ${cause.message}`);
   process.exit(1);
});
