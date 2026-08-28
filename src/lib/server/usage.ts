import { error } from '@sveltejs/kit';
import { runtimeValue } from './runtime';

async function digest(value: string): Promise<string> {
	const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
	return [...bytes].slice(0, 16).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function safetyIdentifier(platform: App.Platform | undefined, clientId: string): Promise<string> {
	const salt = runtimeValue(platform, 'RATE_LIMIT_SALT');
	if (!salt) return `local-${clientId.slice(0, 32)}`;
	return `lingua-${await digest(`${salt}:${clientId}`)}`;
}

export async function consumeAiUnits(platform: App.Platform | undefined, clientId: string, units: number): Promise<string> {
	const identifier = await safetyIdentifier(platform, clientId);
	const env = platform?.env as unknown as {
		AI_RATE_LIMITER?: RateLimit;
		USAGE?: KVNamespace;
	} | undefined;

	if (env?.AI_RATE_LIMITER) {
		const burst = await env.AI_RATE_LIMITER.limit({ key: identifier });
		if (!burst.success) throw error(429, 'You are moving faster than the tutor can check safely. Wait a minute, then continue.');
	}

	if (env?.USAGE) {
		const day = new Date().toISOString().slice(0, 10);
		const key = `ai:${day}:${identifier}`;
		const current = Number(await env.USAGE.get(key)) || 0;
		const maximum = Math.max(10, Number(runtimeValue(platform, 'MAX_DAILY_AI_UNITS')) || 120);
		if (current + units > maximum) throw error(429, 'This browser has reached today’s practice limit. Come back tomorrow.');
		await env.USAGE.put(key, String(current + units), { expirationTtl: 172_800 });
	}

	return identifier;
}
