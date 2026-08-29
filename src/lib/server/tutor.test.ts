import { describe, expect, it } from 'vitest';
import type { GeneratedExercise } from '$lib/contracts';
import { exactReferenceMatch, findReferences } from './tutor';

const exercise: GeneratedExercise = {
	sourceLanguage: 'English',
	sourceLocale: 'en',
	targetLanguage: 'German',
	targetLocale: 'de',
	direction: 'source_to_target',
	cefr: 'B1',
	situation: 'Changing an appointment',
	prompt: 'Could we move the appointment to Friday?',
	promptMeaning: 'The speaker asks to reschedule an appointment for Friday.',
	referenceAnswers: ['Könnten wir den Termin auf Freitag verschieben?', 'Können wir den Termin auf Freitag verlegen?'],
	requiredFacts: ['A polite request', 'Move the appointment', 'Friday'],
	acceptedVariations: ['Either verschieben or verlegen is natural.'],
	sourceLexicon: [],
	answerLexicon: [{ surface: 'verschieben', lemma: 'verschieben', pronunciation: '', definition: 'move or reschedule', morphology: 'infinitive', role: 'main verb after the modal', note: 'Separable in a main clause.' }],
	grammarPoints: []
};

describe('tutor shortcuts and references', () => {
	it('accepts a canonical answer despite punctuation and capitalization', () => {
		expect(exactReferenceMatch(exercise, 'könnten wir den termin auf freitag verschieben')).toBe(true);
	});

	it('does not accept a merely similar answer', () => {
		expect(exactReferenceMatch(exercise, 'Wir treffen uns am Freitag.')).toBe(false);
	});

	it('finds a generated word note by surface or lemma', () => {
		expect(findReferences(exercise, 'verschieben')[0]?.definition).toBe('move or reschedule');
	});
});
