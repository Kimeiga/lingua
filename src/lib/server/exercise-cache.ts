import type { Direction, GeneratedExercise, LearnerProfile } from '$lib/contracts';
import { sanitizeGeneratedExercise } from './openai';

interface CachePool {
	entries: Array<{ createdAt: number; exercise: GeneratedExercise }>;
}

function cacheBinding(platform: App.Platform | undefined): KVNamespace | undefined {
	return (platform?.env as unknown as { EXERCISES?: KVNamespace } | undefined)?.EXERCISES;
}

function safeName(language: string): string {
	return language.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{M}]+/gu, '-').replace(/^-|-$/gu, '');
}

function key(
	sourceLanguage: string,
	sourceLocale: string,
	targetLanguage: string,
	targetLocale: string,
	direction: Direction,
	level: number
): string {
	return `pool:v2:${sourceLocale}:${targetLocale}:${direction}:${level}:${safeName(sourceLanguage)}:${safeName(targetLanguage)}`;
}

function readPool(value: string | null): CachePool {
	if (!value) return { entries: [] };
	try {
		const parsed = JSON.parse(value) as CachePool;
		return Array.isArray(parsed.entries) ? parsed : { entries: [] };
	} catch {
		return { entries: [] };
	}
}

export async function cachedExercise(options: {
	platform: App.Platform | undefined;
	sourceLanguage: string;
	sourceLocale: string;
	targetLanguage: string;
	targetLocale: string;
	direction: Direction;
	profile: LearnerProfile;
}): Promise<GeneratedExercise | null> {
	const binding = cacheBinding(options.platform);
	if (!binding || options.profile.focus.length > 0) return null;
	try {
		const value = await binding.get(key(
			options.sourceLanguage,
			options.sourceLocale,
			options.targetLanguage,
			options.targetLocale,
			options.direction,
			options.profile.level
		));
		const recent = new Set(options.profile.recentPrompts.map((prompt) => prompt.normalize('NFKC').trim()));
		const candidates = readPool(value).entries
			.filter((entry) => Date.now() - entry.createdAt < 30 * 24 * 60 * 60 * 1000)
			.filter((entry) => !recent.has(entry.exercise?.prompt?.normalize('NFKC').trim()));
		if (!candidates.length) return null;
		const random = new Uint32Array(1);
		crypto.getRandomValues(random);
		const selected = candidates[random[0] % candidates.length].exercise;
		return sanitizeGeneratedExercise(
			selected,
			options.sourceLanguage,
			options.sourceLocale,
			options.targetLanguage,
			options.targetLocale,
			options.direction
		);
	} catch (cause) {
		console.warn('Exercise cache read failed', cause);
		return null;
	}
}

export async function cacheExercise(options: {
	platform: App.Platform | undefined;
	exercise: GeneratedExercise;
	level: number;
}): Promise<void> {
	const binding = cacheBinding(options.platform);
	if (!binding) return;
	const poolKey = key(
		options.exercise.sourceLanguage,
		options.exercise.sourceLocale,
		options.exercise.targetLanguage,
		options.exercise.targetLocale,
		options.exercise.direction,
		options.level
	);
	try {
		const pool = readPool(await binding.get(poolKey));
		const withoutDuplicate = pool.entries.filter((entry) => entry.exercise.prompt !== options.exercise.prompt);
		const entries = [{ createdAt: Date.now(), exercise: options.exercise }, ...withoutDuplicate].slice(0, 12);
		await binding.put(poolKey, JSON.stringify({ entries }), { expirationTtl: 30 * 24 * 60 * 60 });
	} catch (cause) {
		console.warn('Exercise cache write failed', cause);
	}
}
