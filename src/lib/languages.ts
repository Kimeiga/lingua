import type { LanguageOption } from './contracts';

export const languages: LanguageOption[] = [
	{ name: 'German', nativeName: 'Deutsch', locale: 'de' },
	{ name: 'Spanish', nativeName: 'Español', locale: 'es' },
	{ name: 'French', nativeName: 'Français', locale: 'fr' },
	{ name: 'Japanese', nativeName: '日本語', locale: 'ja' },
	{ name: 'Mandarin Chinese', nativeName: '中文', locale: 'zh' },
	{ name: 'Korean', nativeName: '한국어', locale: 'ko' },
	{ name: 'Italian', nativeName: 'Italiano', locale: 'it' },
	{ name: 'Portuguese', nativeName: 'Português', locale: 'pt' },
	{ name: 'Dutch', nativeName: 'Nederlands', locale: 'nl' },
	{ name: 'Swedish', nativeName: 'Svenska', locale: 'sv' },
	{ name: 'Norwegian', nativeName: 'Norsk', locale: 'no' },
	{ name: 'Danish', nativeName: 'Dansk', locale: 'da' },
	{ name: 'Polish', nativeName: 'Polski', locale: 'pl' },
	{ name: 'Czech', nativeName: 'Čeština', locale: 'cs' },
	{ name: 'Greek', nativeName: 'Ελληνικά', locale: 'el' },
	{ name: 'Turkish', nativeName: 'Türkçe', locale: 'tr' },
	{ name: 'Russian', nativeName: 'Русский', locale: 'ru' },
	{ name: 'Ukrainian', nativeName: 'Українська', locale: 'uk' },
	{ name: 'Arabic', nativeName: 'العربية', locale: 'ar' },
	{ name: 'Hebrew', nativeName: 'עברית', locale: 'he' },
	{ name: 'Hindi', nativeName: 'हिन्दी', locale: 'hi' },
	{ name: 'Vietnamese', nativeName: 'Tiếng Việt', locale: 'vi' },
	{ name: 'Thai', nativeName: 'ไทย', locale: 'th' },
	{ name: 'Indonesian', nativeName: 'Bahasa Indonesia', locale: 'id' }
];

export function languageFromName(name: string): LanguageOption {
	const cleaned = name.trim();
	return languages.find((language) => language.name.toLocaleLowerCase() === cleaned.toLocaleLowerCase()) ?? {
		name: cleaned,
		nativeName: cleaned,
		locale: 'und'
	};
}

