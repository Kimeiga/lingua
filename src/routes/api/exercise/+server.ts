import { error, isHttpError, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ExerciseState, PublicExercise } from '$lib/contracts';
import { cachedExercise, cacheExercise } from '$lib/server/exercise-cache';
import { chooseDirection, parseClientId, parseDirections, parseLanguage, sanitizeProfile } from '$lib/server/input';
import { generateExercise } from '$lib/server/openai';
import { requireRuntimeValue, runtimeValue } from '$lib/server/runtime';
import { sealState } from '$lib/server/state';
import { consumeAiUnits } from '$lib/server/usage';

export const POST: RequestHandler = async ({ request, platform, fetch }) => {
	const body = await request.json().catch(() => null) as Record<string, unknown> | null;
	if (!body) throw error(400, 'The session settings could not be read.');
	const language = parseLanguage(body.language);
	const direction = chooseDirection(parseDirections(body.directions));
	const profile = sanitizeProfile(body.profile);
	const clientId = parseClientId(body.clientId);
	const stateSecret = runtimeValue(platform, 'TUTOR_STATE_SECRET');
	if (!stateSecret) throw error(503, 'The tutor is not configured yet.');

	try {
		let exercise = await cachedExercise({ platform, language: language.name, locale: language.locale, direction, profile });
		if (!exercise) {
			const apiKey = runtimeValue(platform, 'OPENAI_API_KEY');
			if (!apiKey) throw error(503, 'The tutor is not configured yet.');
			const identifier = await consumeAiUnits(platform, clientId, 3);
			exercise = await generateExercise({
				fetcher: fetch,
				apiKey,
				model: runtimeValue(platform, 'OPENAI_MODEL') || 'gpt-5.6-sol',
				targetLanguage: language.name,
				targetLocale: language.locale,
				direction,
				profile,
				safetyIdentifier: identifier
			});
			const cacheWrite = cacheExercise({ platform, exercise, level: profile.level });
			if (platform?.ctx) platform.ctx.waitUntil(cacheWrite);
			else await cacheWrite;
		}
		const now = Date.now();
		const state: ExerciseState = {
			id: crypto.randomUUID(),
			createdAt: now,
			expiresAt: now + 4 * 60 * 60 * 1000,
			exercise
		};
		const stateToken = await sealState(state, requireRuntimeValue(platform, 'TUTOR_STATE_SECRET'));
		const result: PublicExercise = {
			id: state.id,
			stateToken,
			targetLanguage: exercise.targetLanguage,
			targetLocale: exercise.targetLocale,
			direction: exercise.direction,
			cefr: exercise.cefr,
			situation: exercise.situation,
			prompt: exercise.prompt
		};
		return json(result, { headers: { 'cache-control': 'no-store' } });
	} catch (cause) {
		if (isHttpError(cause)) throw cause;
		console.error('Exercise generation failed', cause);
		throw error(502, 'The tutor could not prepare a sentence. Try again in a moment.');
	}
};
