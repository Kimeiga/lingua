import type { ExerciseState } from '$lib/contracts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
	const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

async function stateKey(secret: string): Promise<CryptoKey> {
	const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
	return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function sealState(state: ExerciseState, secret: string): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv, additionalData: encoder.encode('lingua:v1') },
		await stateKey(secret),
		encoder.encode(JSON.stringify(state))
	);
	return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

export async function openState(token: string, secret: string): Promise<ExerciseState> {
	const [version, ivValue, payloadValue, extra] = token.split('.');
	if (version !== 'v1' || !ivValue || !payloadValue || extra) throw new Error('Invalid state token');
	const plaintext = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: fromBase64Url(ivValue), additionalData: encoder.encode('lingua:v1') },
		await stateKey(secret),
		fromBase64Url(payloadValue)
	);
	const state = JSON.parse(decoder.decode(plaintext)) as ExerciseState;
	if (!state || typeof state.id !== 'string' || !state.exercise || !Number.isFinite(state.expiresAt)) {
		throw new Error('Invalid state payload');
	}
	if (state.expiresAt < Date.now()) throw new Error('Expired state token');
	return state;
}
