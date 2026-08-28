import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cleanString } from '$lib/server/input';
import { runtimeValue } from '$lib/server/runtime';
import { openState } from '$lib/server/state';
import { findReferences } from '$lib/server/tutor';

export const POST: RequestHandler = async ({ request, platform }) => {
	const body = await request.json().catch(() => null) as Record<string, unknown> | null;
	const query = cleanString(body?.query, 120);
	const token = cleanString(body?.stateToken, 80_000);
	const scope = body?.scope === 'source' || body?.scope === 'answer' ? body.scope : 'all';
	if (!query || !token) throw error(400, 'Select a word to inspect.');
	const secret = runtimeValue(platform, 'TUTOR_STATE_SECRET');
	if (!secret) throw error(503, 'The tutor is not configured yet.');
	try {
		const state = await openState(token, secret);
		return json({ query, entries: findReferences(state.exercise, query, scope) }, {
			headers: { 'cache-control': 'private, max-age=300' }
		});
	} catch {
		throw error(400, 'This sentence has expired. Start a new one to continue.');
	}
};
