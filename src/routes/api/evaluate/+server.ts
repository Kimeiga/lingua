import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cleanString, cleanStrings, parseClientId, sanitizeProfile } from '$lib/server/input';
import { evaluateAnswer } from '$lib/server/openai';
import { runtimeValue } from '$lib/server/runtime';
import { openState } from '$lib/server/state';
import { exactReferenceMatch, referenceMatchResult } from '$lib/server/tutor';
import { consumeAiUnits } from '$lib/server/usage';

export const POST: RequestHandler = async ({ request, platform, fetch }) => {
	const body = await request.json().catch(() => null) as Record<string, unknown> | null;
	if (!body) throw error(400, 'The answer could not be read.');
	const answer = cleanString(body.answer, 1600);
	const token = cleanString(body.stateToken, 80_000);
	const clientId = parseClientId(body.clientId);
	if (!answer || !token) throw error(400, 'Write an answer before checking it.');
	const secret = runtimeValue(platform, 'TUTOR_STATE_SECRET');
	const apiKey = runtimeValue(platform, 'OPENAI_API_KEY');
	if (!secret || !apiKey) throw error(503, 'The tutor is not configured yet.');

	let state;
	try {
		state = await openState(token, secret);
	} catch {
		throw error(400, 'This sentence has expired. Start a new one to continue.');
	}

	const profile = sanitizeProfile(body.profile);
	if (exactReferenceMatch(state.exercise, answer)) {
		return json(referenceMatchResult(state.exercise, profile), { headers: { 'cache-control': 'no-store' } });
	}

	const identifier = await consumeAiUnits(platform, clientId, 1);
	try {
		const result = await evaluateAnswer({
			fetcher: fetch,
			apiKey,
			model: runtimeValue(platform, 'OPENAI_MODEL') || 'gpt-5.6-sol',
			exercise: state.exercise,
			answer,
			attempt: Math.max(1, Math.min(20, Math.round(Number(body.attempt) || 1))),
			priorHints: cleanStrings(body.priorHints, 3, 320),
			profile,
			safetyIdentifier: identifier
		});
		return json(result, { headers: { 'cache-control': 'no-store' } });
	} catch (cause) {
		console.error('Answer evaluation failed', cause);
		throw error(502, 'The tutor could not check that answer. Your writing is still here—try again in a moment.');
	}
};

