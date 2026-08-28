import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

// Wrangler adds a main-module import when adapter output already exists. That
// import makes the source checker traverse compiled Worker JavaScript. Remove
// only the disposable adapter output so the generated Env remains standalone.
await rm(resolve('.svelte-kit/cloudflare'), { recursive: true, force: true });

const executable = resolve('node_modules/.bin/wrangler');
const child = spawn(executable, ['types'], { stdio: 'inherit' });
child.once('error', (error) => {
	console.error(error);
	process.exitCode = 1;
});
child.once('exit', (code) => {
	process.exitCode = code ?? 1;
});
