import { execFileSync } from 'node:child_process';
import net from 'node:net';

/**
 * Windows does not deliver SIGTERM to a Node process, so killing the
 * `serve.mjs` wrapper can leave `wrangler`/`workerd` holding the e2e port after
 * an aborted run. Reclaim the port before Playwright's own "already used" check
 * runs, and only when the holder really is a stale wrangler process.
 *
 * The process is found by its command line rather than by `netstat`: workerd
 * does not always appear as a listening socket there on Windows.
 */
const PORT = Number(process.env.E2E_PORT ?? 8788);

function portIsOpen(port) {
   return new Promise((resolve) => {
      const socket = net.connect({ host: '127.0.0.1', port });
      const finish = (open) => {
         socket.destroy();
         resolve(open);
      };
      socket.setTimeout(400);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
   });
}

function run(command, args) {
   return execFileSync(command, args, { encoding: 'utf8', windowsHide: true }).trim();
}

/** PIDs of wrangler/workerd processes that reference this port. */
function serverPids() {
   const portPattern = `(?:--port\\s+${PORT}|:${PORT}(?!\\d))`;

   if (process.platform === 'win32') {
      const filter = [
         `Get-CimInstance Win32_Process`,
         `Where-Object { $_.CommandLine -and $_.CommandLine -match 'wrangler|workerd' -and $_.CommandLine -match '${portPattern}' }`,
         `ForEach-Object { $_.ProcessId }`,
      ].join(' | ');
      const output = run('powershell', ['-NoProfile', '-NonInteractive', '-Command', filter]);
      return output
         .split(/\r?\n/)
         .map((line) => Number(line.trim()))
         .filter((pid) => Number.isInteger(pid) && pid > 0);
   }

   const output = run('ps', ['-eo', 'pid=,command=']);
   return output
      .split(/\r?\n/)
      .filter((line) => /wrangler|workerd/.test(line) && new RegExp(portPattern).test(line))
      .map((line) => Number(line.trim().split(/\s+/)[0]))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
}

export async function freePort() {
   if (!(await portIsOpen(PORT))) return true;

   const pids = serverPids();
   if (pids.length === 0) {
      console.error(
         `[e2e] ${PORT} is in use by something that is not wrangler/workerd. Stop it or set E2E_PORT.`,
      );
      process.exitCode = 1;
      return false;
   }

   console.log(
      `[e2e] Reclaiming port ${PORT} from a stale wrangler process (pid ${pids.join(', ')})`,
   );

   for (const pid of pids) {
      try {
         if (process.platform === 'win32') {
            execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
               stdio: 'ignore',
               windowsHide: true,
            });
         } else {
            process.kill(pid, 'SIGKILL');
         }
      } catch {
         // The process may already be gone.
      }
   }

   for (let attempt = 0; attempt < 25; attempt += 1) {
      if (!(await portIsOpen(PORT))) return true;
      await new Promise((resolve) => setTimeout(resolve, 200));
   }

   console.error(`[e2e] ${PORT} is still in use after reclaiming it.`);
   process.exitCode = 1;
   return false;
}
