import { describe, expect, it } from 'vitest';
import { defaultProfile, type GeneratedExercise } from '$lib/contracts';
import { cachedExercise, cacheExercise } from './exercise-cache';

const exercise: GeneratedExercise = {
	targetLanguage: 'German',
	targetLocale: 'de',
	direction: 'target_to_english',
	cefr: 'B1',
	situation: 'Leaving soon',
	prompt: 'Der Bus fährt in fünf Minuten.',
	promptMeaning: 'The bus leaves in five minutes.',
	referenceAnswers: ['The bus leaves in five minutes.', 'The bus is leaving in five minutes.'],
	requiredFacts: ['The bus leaves', 'in five minutes'],
	acceptedVariations: ['English simple present or present progressive'],
	sourceLexicon: [{ surface: 'Bus', lemma: 'Bus', pronunciation: 'bʊs', definition: 'bus', morphology: 'masculine singular noun', role: 'subject', note: '' }],
	answerLexicon: [{ surface: 'bus', lemma: 'bus', pronunciation: '', definition: 'public road vehicle', morphology: 'singular noun', role: 'subject', note: '' }],
	grammarPoints: [{ title: 'Present for schedules', explanation: 'German present can describe a scheduled departure.', pattern: 'fährt in … Minuten' }]
};

function fakePlatform() {
	const values = new Map<string, string>();
	const kv = {
		get: async (key: string) => values.get(key) ?? null,
		put: async (key: string, value: string) => { values.set(key, value); }
	} as unknown as KVNamespace;
	return { env: { EXERCISES: kv } } as unknown as App.Platform;
}

describe('incremental exercise pool', () => {
	it('reuses a generated exercise but does not repeat a recent prompt', async () => {
		const platform = fakePlatform();
		await cacheExercise({ platform, exercise, level: 3 });
		const first = await cachedExercise({
			platform,
			language: 'German',
			locale: 'de',
			direction: 'target_to_english',
			profile: { ...defaultProfile }
		});
		expect(first?.prompt).toBe(exercise.prompt);

		const repeated = await cachedExercise({
			platform,
			language: 'German',
			locale: 'de',
			direction: 'target_to_english',
			profile: { ...defaultProfile, recentPrompts: [exercise.prompt] }
		});
		expect(repeated).toBeNull();
	});
});
