import { describe, expect, it } from 'vitest';
import { additionalLanguages, languageFromLocale, languages, popularLanguages } from './languages';

describe('language catalog', () => {
	it('starts with the 2025 worldwide learner popularity ranking', () => {
		expect(popularLanguages.map((language) => language.name)).toEqual([
			'English',
			'Spanish',
			'French',
			'Japanese',
			'German',
			'Korean',
			'Italian',
			'Mandarin Chinese',
			'Portuguese',
			'Hindi'
		]);
	});

	it('keeps the remaining languages alphabetical and locales unique', () => {
		expect(additionalLanguages.map((language) => language.name)).toEqual(
			additionalLanguages.map((language) => language.name).toSorted()
		);
		expect(new Set(languages.map((language) => language.locale)).size).toBe(languages.length);
		expect(languageFromLocale('ja').name).toBe('Japanese');
	});
});
