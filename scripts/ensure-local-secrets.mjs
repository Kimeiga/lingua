import { randomBytes } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const path = resolve('.env.local');
let contents = '';
try {
	contents = await readFile(path, 'utf8');
} catch (error) {
	if (error?.code !== 'ENOENT') throw error;
}

const names = new Set(contents.split(/\r?\n/u).map((line) => line.split('=', 1)[0]?.trim()).filter(Boolean));
const added = [];
for (const name of ['TUTOR_STATE_SECRET', 'RATE_LIMIT_SALT']) {
	if (names.has(name)) continue;
	contents += `${contents && !contents.endsWith('\n') ? '\n' : ''}${name}=${randomBytes(48).toString('base64url')}\n`;
	added.push(name);
}

if (added.length) await writeFile(path, contents, { mode: 0o600 });
await chmod(path, 0o600);
console.info(added.length ? `Added ${added.join(' and ')} to .env.local.` : 'Local secrets are already present.');
