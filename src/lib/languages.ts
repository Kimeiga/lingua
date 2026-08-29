import type { LanguageOption } from './contracts';

// The first ten follow Duolingo's 2025 worldwide study ranking. The remaining
// practical learner languages stay in a separate, alphabetized group in the UI.
export const languages: LanguageOption[] = [
	{ name: 'English', nativeName: 'English', locale: 'en' },
	{ name: 'Spanish', nativeName: 'Español', locale: 'es' },
	{ name: 'French', nativeName: 'Français', locale: 'fr' },
	{ name: 'Japanese', nativeName: '日本語', locale: 'ja' },
	{ name: 'German', nativeName: 'Deutsch', locale: 'de' },
	{ name: 'Korean', nativeName: '한국어', locale: 'ko' },
	{ name: 'Italian', nativeName: 'Italiano', locale: 'it' },
	{ name: 'Mandarin Chinese', nativeName: '中文', locale: 'zh' },
	{ name: 'Portuguese', nativeName: 'Português', locale: 'pt' },
	{ name: 'Hindi', nativeName: 'हिन्दी', locale: 'hi' },
	{ name: 'Arabic', nativeName: 'العربية', locale: 'ar' },
	{ name: 'Bengali', nativeName: 'বাংলা', locale: 'bn' },
	{ name: 'Cantonese', nativeName: '粵語', locale: 'yue' },
	{ name: 'Czech', nativeName: 'Čeština', locale: 'cs' },
	{ name: 'Danish', nativeName: 'Dansk', locale: 'da' },
	{ name: 'Dutch', nativeName: 'Nederlands', locale: 'nl' },
	{ name: 'Filipino', nativeName: 'Filipino', locale: 'fil' },
	{ name: 'Finnish', nativeName: 'Suomi', locale: 'fi' },
	{ name: 'Greek', nativeName: 'Ελληνικά', locale: 'el' },
	{ name: 'Haitian Creole', nativeName: 'Kreyòl ayisyen', locale: 'ht' },
	{ name: 'Hebrew', nativeName: 'עברית', locale: 'he' },
	{ name: 'Hungarian', nativeName: 'Magyar', locale: 'hu' },
	{ name: 'Indonesian', nativeName: 'Bahasa Indonesia', locale: 'id' },
	{ name: 'Irish', nativeName: 'Gaeilge', locale: 'ga' },
	{ name: 'Persian', nativeName: 'فارسی', locale: 'fa' },
	{ name: 'Polish', nativeName: 'Polski', locale: 'pl' },
	{ name: 'Romanian', nativeName: 'Română', locale: 'ro' },
	{ name: 'Russian', nativeName: 'Русский', locale: 'ru' },
	{ name: 'Scottish Gaelic', nativeName: 'Gàidhlig', locale: 'gd' },
	{ name: 'Swahili', nativeName: 'Kiswahili', locale: 'sw' },
	{ name: 'Swedish', nativeName: 'Svenska', locale: 'sv' },
	{ name: 'Tamil', nativeName: 'தமிழ்', locale: 'ta' },
	{ name: 'Telugu', nativeName: 'తెలుగు', locale: 'te' },
	{ name: 'Thai', nativeName: 'ไทย', locale: 'th' },
	{ name: 'Turkish', nativeName: 'Türkçe', locale: 'tr' },
	{ name: 'Ukrainian', nativeName: 'Українська', locale: 'uk' },
	{ name: 'Urdu', nativeName: 'اردو', locale: 'ur' },
	{ name: 'Vietnamese', nativeName: 'Tiếng Việt', locale: 'vi' },
	{ name: 'Welsh', nativeName: 'Cymraeg', locale: 'cy' },
	{ name: 'Yiddish', nativeName: 'ייִדיש', locale: 'yi' },
	{ name: 'Zulu', nativeName: 'isiZulu', locale: 'zu' }
];

export const popularLanguages = languages.slice(0, 10);
export const additionalLanguages = languages.slice(10).sort((left, right) => left.name.localeCompare(right.name));

export function languageFromLocale(locale: string): LanguageOption {
	return languages.find((language) => language.locale === locale) ?? languages[0];
}

export function languageFromName(name: string): LanguageOption {
	const cleaned = name.trim();
	return languages.find((language) => language.name.toLocaleLowerCase() === cleaned.toLocaleLowerCase()) ?? languages[4];
}
