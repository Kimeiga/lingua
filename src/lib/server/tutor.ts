import type { EvaluationResult, GeneratedExercise, LearnerProfile, Lexeme } from '$lib/contracts';
import { normalizeAnswer } from './input';

export function exactReferenceMatch(exercise: GeneratedExercise, answer: string): boolean {
	const normalized = normalizeAnswer(answer);
	return Boolean(normalized) && exercise.referenceAnswers.some((candidate) => normalizeAnswer(candidate) === normalized);
}

export function referenceMatchResult(exercise: GeneratedExercise, profile: LearnerProfile): EvaluationResult {
	return {
		status: 'correct',
		summary: 'That preserves the full meaning and sounds natural.',
		issues: [],
		hint: '',
		grammarPoints: exercise.grammarPoints.slice(0, 3),
		learnerUpdate: {
			observedLevel: profile.observedLevel,
			strengths: [...new Set([...profile.strengths, 'Accurate translation'])].slice(-4),
			focus: profile.focus,
			difficultyDelta: 0
		},
		source: 'reference-match'
	};
}

function lookupKey(value: string): string {
	return value
		.normalize('NFKC')
		.toLocaleLowerCase()
		.replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '')
		.trim();
}

export function findReferences(exercise: GeneratedExercise, query: string, scope: 'source' | 'answer' | 'all' = 'all'): Lexeme[] {
	const key = lookupKey(query);
	if (!key) return [];
	const all = scope === 'source'
		? exercise.sourceLexicon
		: scope === 'answer' ? exercise.answerLexicon : [...exercise.sourceLexicon, ...exercise.answerLexicon];
	const exact = all.filter((entry) => {
		const surface = lookupKey(entry.surface);
		const lemma = lookupKey(entry.lemma);
		return key === surface || key === lemma;
	});
	const candidates = exact.length ? exact : all.filter((entry) => {
		const surface = lookupKey(entry.surface);
		return surface.includes(' ') && surface.split(/\s+/u).includes(key);
	});
	const seen = new Set<string>();
	return candidates.filter((entry) => {
		const signature = `${entry.surface}\u0000${entry.lemma}\u0000${entry.definition}`;
		if (seen.has(signature)) return false;
		seen.add(signature);
		return true;
	}).slice(0, 4);
}
