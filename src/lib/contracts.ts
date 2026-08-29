export type Direction = 'target_to_source' | 'source_to_target';
export type TutorStatus = 'correct' | 'repairable' | 'retry';

export interface LanguageOption {
	name: string;
	locale: string;
	nativeName: string;
}

export interface LearnerProfile {
	level: number;
	observedLevel: string;
	strengths: string[];
	focus: string[];
	attempts: number;
	correct: number;
	recentPrompts: string[];
}

export interface Lexeme {
	surface: string;
	lemma: string;
	pronunciation: string;
	definition: string;
	morphology: string;
	role: string;
	note: string;
}

export interface GrammarPoint {
	title: string;
	explanation: string;
	pattern: string;
}

export interface GeneratedExercise {
	sourceLanguage: string;
	sourceLocale: string;
	targetLanguage: string;
	targetLocale: string;
	direction: Direction;
	cefr: string;
	situation: string;
	prompt: string;
	promptMeaning: string;
	referenceAnswers: string[];
	requiredFacts: string[];
	acceptedVariations: string[];
	sourceLexicon: Lexeme[];
	answerLexicon: Lexeme[];
	grammarPoints: GrammarPoint[];
}

export interface ExerciseState {
	id: string;
	createdAt: number;
	expiresAt: number;
	exercise: GeneratedExercise;
}

export interface PublicExercise {
	id: string;
	stateToken: string;
	sourceLanguage: string;
	sourceLocale: string;
	targetLanguage: string;
	targetLocale: string;
	direction: Direction;
	cefr: string;
	situation: string;
	prompt: string;
}

export interface TutorIssue {
	text: string;
	occurrence: number;
	category: 'grammar' | 'meaning' | 'word_choice' | 'register' | 'spelling' | 'word_order';
	tooltip: string;
	detail: string;
}

export interface LearnerUpdate {
	observedLevel: string;
	strengths: string[];
	focus: string[];
	difficultyDelta: -1 | 0 | 1;
}

export interface EvaluationResult {
	status: TutorStatus;
	summary: string;
	issues: TutorIssue[];
	hint: string;
	grammarPoints: GrammarPoint[];
	learnerUpdate: LearnerUpdate;
	source: 'reference-match' | 'gpt-5.6-sol';
}

export interface ReferenceResult {
	query: string;
	entries: Lexeme[];
}

export const defaultProfile: LearnerProfile = {
	level: 3,
	observedLevel: 'Intermediate',
	strengths: [],
	focus: [],
	attempts: 0,
	correct: 0,
	recentPrompts: []
};
