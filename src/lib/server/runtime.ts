import { env as privateEnv } from '$env/dynamic/private';

export function runtimeValue(platform: App.Platform | undefined, key: string): string {
	const platformEnv = platform?.env as unknown as Record<string, unknown> | undefined;
	const value = platformEnv?.[key] ?? privateEnv[key];
	return typeof value === 'string' ? value : '';
}

export function requireRuntimeValue(platform: App.Platform | undefined, key: string): string {
	const value = runtimeValue(platform, key);
	if (!value) throw new Error(`Missing required runtime value: ${key}`);
	return value;
}

