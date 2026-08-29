import { describe, expect, it } from 'vitest';
import { isRetryableOpenAIError, sanitizeEvaluation, sanitizeGeneratedExercise } from './openai';

describe('model output validation', () => {
	it('forces requested language and direction instead of trusting model metadata', () => {
		const exercise = sanitizeGeneratedExercise({
			targetLanguage: 'Wrong',
			targetLocale: 'xx',
			direction: 'source_to_target',
			cefr: 'B1',
			situation: 'A delayed train',
			prompt: 'Der Zug fällt heute aus.',
			promptMeaning: 'The train is cancelled today.',
			referenceAnswers: ['The train is cancelled today.', "Today's train is cancelled."],
			requiredFacts: ['train', 'cancelled', 'today'],
			acceptedVariations: ['cancelled or canceled'],
			sourceLexicon: [{ surface: 'fällt aus', lemma: 'ausfallen', pronunciation: '', definition: 'is cancelled', morphology: 'third-person present', role: 'predicate', note: '' }],
			answerLexicon: [{ surface: 'cancelled', lemma: 'cancel', pronunciation: '', definition: 'not running', morphology: 'past participle', role: 'predicate', note: '' }],
			grammarPoints: [{ title: 'ausfallen', explanation: 'A separable verb.', pattern: 'fällt … aus' }]
		}, 'English', 'en', 'German', 'de', 'target_to_source');
		expect(exercise.sourceLanguage).toBe('English');
		expect(exercise.targetLanguage).toBe('German');
		expect(exercise.direction).toBe('target_to_source');
	});

	it('downgrades repairable feedback when the issue span is not in the answer', () => {
		const result = sanitizeEvaluation({
			status: 'repairable',
			summary: 'Almost',
			issues: [{ text: 'missing', occurrence: 1, category: 'grammar', tooltip: 'Fix it.', detail: 'A detail.' }],
			hint: 'Check the verb.',
			grammarPoints: [],
			learnerUpdate: { observedLevel: 'B1', strengths: [], focus: [], difficultyDelta: 0 }
		}, 'present answer', []);
		expect(result.status).toBe('retry');
		expect(result.issues).toEqual([]);
	});

	it('retries transient provider failures but not deterministic client errors', () => {
		expect(isRetryableOpenAIError(new Error('OpenAI response was incomplete: max_output_tokens'))).toBe(true);
		expect(isRetryableOpenAIError(new Error('OpenAI request failed with 503'))).toBe(true);
		expect(isRetryableOpenAIError(new Error('OpenAI request failed with 400: invalid schema'))).toBe(false);
	});
});
