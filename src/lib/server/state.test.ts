import { describe, expect, it } from 'vitest';
import type { ExerciseState } from '$lib/contracts';
import { openState, sealState } from './state';

function fixture(): ExerciseState {
	return {
		id: 'exercise-1',
		createdAt: Date.now(),
		expiresAt: Date.now() + 60_000,
		exercise: {
			sourceLanguage: 'English',
			sourceLocale: 'en',
			targetLanguage: 'German',
			targetLocale: 'de',
			direction: 'target_to_source',
			cefr: 'B1',
			situation: 'Making plans after work',
			prompt: 'Ich schaffe es heute nicht mehr.',
			promptMeaning: 'I will not manage it today after all.',
			referenceAnswers: ["I won't manage it today after all.", "I can't get it done today after all."],
			requiredFacts: ['The speaker will not manage it today.'],
			acceptedVariations: ['Contractions are acceptable.'],
			sourceLexicon: [{ surface: 'schaffe', lemma: 'schaffen', pronunciation: '', definition: 'manage', morphology: 'first-person present', role: 'main verb', note: '' }],
			answerLexicon: [{ surface: 'manage', lemma: 'manage', pronunciation: '', definition: 'succeed in doing', morphology: 'base form', role: 'main verb', note: '' }],
			grammarPoints: [{ title: 'es schaffen', explanation: 'This expression means to manage or succeed.', pattern: 'es + schaffen' }]
		}
	};
}

describe('encrypted exercise state', () => {
	it('round-trips without exposing plaintext', async () => {
		const state = fixture();
		const token = await sealState(state, 'test-secret');
		expect(token).not.toContain(state.exercise.referenceAnswers[0]);
		expect(await openState(token, 'test-secret')).toEqual(state);
	});

	it('rejects a modified token', async () => {
		const token = await sealState(fixture(), 'test-secret');
		const parts = token.split('.');
		const position = Math.floor(parts[2].length / 2);
		parts[2] = `${parts[2].slice(0, position)}${parts[2][position] === 'A' ? 'B' : 'A'}${parts[2].slice(position + 1)}`;
		await expect(openState(parts.join('.'), 'test-secret')).rejects.toThrow();
	});
});
