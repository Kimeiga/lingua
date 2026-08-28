import { error } from '@sveltejs/kit';
import { defaultProfile, type Direction, type LearnerProfile } from '$lib/contracts';

const directionValues = new Set<Direction>(['target_to_english', 'english_to_target']);

export function cleanString(value: unknown, limit: number): string {
	return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

export function cleanStrings(value: unknown, limit: number, itemLimit: number): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((item): item is string => typeof item === 'string')
		.map((item) => item.trim().slice(0, itemLimit))
		.filter(Boolean)
		.slice(0, limit);
}

export function parseLanguage(value: unknown): { name: string; locale: string } {
	if (!value || typeof value !== 'object') throw error(400, 'Choose a target language.');
	const record = value as Record<string, unknown>;
	const name = cleanString(record.name, 48);
	const locale = cleanString(record.locale, 16) || 'und';
	if (!name || !/^[\p{L}\p{M} .()'’-]+$/u.test(name)) throw error(400, 'Choose a valid target language.');
	if (!/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$|^und$/.test(locale)) throw error(400, 'Choose a valid language locale.');
	return { name, locale };
}

export function parseDirections(value: unknown): Direction[] {
	if (!Array.isArray(value)) throw error(400, 'Choose at least one practice direction.');
	const directions = [...new Set(value.filter((item): item is Direction => directionValues.has(item as Direction)))];
	if (directions.length === 0) throw error(400, 'Choose at least one practice direction.');
	return directions;
}

export function sanitizeProfile(value: unknown): LearnerProfile {
	const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
	return {
		level: Math.max(1, Math.min(5, Math.round(Number(record.level) || defaultProfile.level))),
		observedLevel: cleanString(record.observedLevel, 48) || defaultProfile.observedLevel,
		strengths: cleanStrings(record.strengths, 4, 80),
		focus: cleanStrings(record.focus, 4, 80),
		attempts: Math.max(0, Math.min(100_000, Math.round(Number(record.attempts) || 0))),
		correct: Math.max(0, Math.min(100_000, Math.round(Number(record.correct) || 0))),
		recentPrompts: cleanStrings(record.recentPrompts, 4, 240)
	};
}

export function parseClientId(value: unknown): string {
	const clientId = cleanString(value, 80);
	if (!/^[a-zA-Z0-9_-]{16,80}$/.test(clientId)) throw error(400, 'This practice session needs to be refreshed.');
	return clientId;
}

export function chooseDirection(directions: Direction[]): Direction {
	if (directions.length === 1) return directions[0];
	const random = new Uint32Array(1);
	crypto.getRandomValues(random);
	return directions[random[0] % directions.length];
}

export function normalizeAnswer(value: string): string {
	return value
		.normalize('NFKC')
		.toLocaleLowerCase()
		.replace(/[\p{P}\p{S}\s]+/gu, '')
		.trim();
}

