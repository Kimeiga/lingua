import { expect, test } from '@playwright/test';

const exercise = {
	id: 'exercise-1',
	stateToken: 'mock-state',
	sourceLanguage: 'English',
	sourceLocale: 'en',
	targetLanguage: 'German',
	targetLocale: 'de',
	direction: 'target_to_source',
	cefr: 'B1',
	situation: 'Calling someone even though it is late',
	prompt: 'Obwohl es spät ist, rufe ich sie noch an.'
};

test('keeps every setup control above the visible iOS Safari fold', async ({ page }, testInfo) => {
	await page.setViewportSize({ width: 390, height: 664 });
	await page.goto('/');

	const controls = [
		page.locator('#source-language'),
		page.locator('#target-language'),
		page.getByRole('checkbox').first(),
		page.getByRole('checkbox').last(),
		page.getByRole('button', { name: /^Start/ })
	];
	for (const control of controls) await expect(control).toBeVisible();

	const startBox = await page.getByRole('button', { name: /^Start/ }).boundingBox();
	expect(startBox).not.toBeNull();
	// Keep clear of Safari's floating bottom toolbar, not merely inside the CSS viewport.
	expect(startBox!.y + startBox!.height).toBeLessThanOrEqual(592);

	const pageMetrics = await page.evaluate(() => ({
		innerHeight,
		scrollHeight: document.documentElement.scrollHeight,
		bodyOverflow: getComputedStyle(document.body).overflowY
	}));
	expect(pageMetrics.scrollHeight).toBeLessThanOrEqual(pageMetrics.innerHeight + 1);
	expect(pageMetrics.bodyOverflow).not.toBe('hidden');
	await page.screenshot({ path: testInfo.outputPath('mobile-setup-fold.png') });
});

test('allows native setup scrolling on a shorter mobile viewport', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 500 });
	await page.goto('/');

	const before = await page.evaluate(() => ({
		innerHeight,
		scrollHeight: document.documentElement.scrollHeight,
		bodyOverflow: getComputedStyle(document.body).overflowY
	}));
	expect(before.scrollHeight).toBeGreaterThan(before.innerHeight);
	expect(before.bodyOverflow).not.toBe('hidden');

	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
	expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
	await expect(page.getByRole('button', { name: /^Start/ })).toBeVisible();
});

test('orders popular languages first and automatically swaps matching selections', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /^Start/ })).toBeEnabled();
	const source = page.locator('#source-language');
	const target = page.locator('#target-language');

	await expect(source).toHaveValue('en');
	await expect(target).toHaveValue('de');
	await expect(target.locator('optgroup').first().locator('option')).toHaveText([
		'English',
		'Spanish · Español',
		'French · Français',
		'Japanese · 日本語',
		'German · Deutsch',
		'Korean · 한국어',
		'Italian · Italiano',
		'Mandarin Chinese · 中文',
		'Portuguese · Português',
		'Hindi · हिन्दी'
	]);

	await source.selectOption('de');
	await expect(source).toHaveValue('de');
	await expect(target).toHaveValue('en');

	await target.selectOption('de');
	await expect(source).toHaveValue('en');
	await expect(target).toHaveValue('de');

	await page.getByRole('button', { name: 'Swap source and target languages' }).click();
	await expect(source).toHaveValue('de');
	await expect(target).toHaveValue('en');
});

test('migrates the original English-based session settings', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('lingua-settings-v1', JSON.stringify({
		language: 'Japanese',
		targetToEnglish: false,
		englishToTarget: true
	})));
	await page.goto('/');

	await expect(page.locator('#source-language')).toHaveValue('en');
	await expect(page.locator('#target-language')).toHaveValue('ja');
	await expect(page.getByRole('checkbox').first()).not.toBeChecked();
	await expect(page.getByRole('checkbox').last()).toBeChecked();
});

test('starts German practice, teaches a repair, and opens the word pane', async ({ page }, testInfo) => {
	let checks = 0;
	const exerciseBodies: Record<string, unknown>[] = [];
	await page.route('**/api/exercise', (route) => {
		exerciseBodies.push(route.request().postDataJSON() as Record<string, unknown>);
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(exercise) });
	});
	await page.route('**/api/reference', (route) => route.fulfill({
		status: 200,
		contentType: 'application/json',
		body: JSON.stringify({ query: 'Obwohl', entries: [{
			surface: 'Obwohl', lemma: 'obwohl', pronunciation: '', definition: 'although', morphology: 'subordinating conjunction',
			role: 'introduces the concessive subordinate clause', note: 'It sends the finite verb to the end of its clause.'
		}] })
	}));
	await page.route('**/api/evaluate', (route) => {
		checks += 1;
		const body = checks === 1 ? {
			status: 'repairable', summary: 'Close.', hint: 'The last particle means the call still happens despite the late hour.',
			issues: [{ text: 'tomorrow', occurrence: 1, category: 'meaning', tooltip: 'This changes when the call happens.', detail: 'The German sentence says the speaker will still call now, not tomorrow.' }],
			grammarPoints: [], learnerUpdate: { observedLevel: 'Intermediate', strengths: [], focus: ['discourse particles'], difficultyDelta: 0 }, source: 'gpt-5.6-sol'
		} : {
			status: 'correct', summary: 'You preserved both the concession and the decision to call.', hint: '', issues: [],
			grammarPoints: [{ title: 'Although + still', explanation: 'The two clauses form a concession.', pattern: 'although … still …' }],
			learnerUpdate: { observedLevel: 'Intermediate', strengths: ['concessions'], focus: [], difficultyDelta: 0 }, source: 'gpt-5.6-sol'
		};
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
	});

	await page.goto('/');
	await expect(page.getByRole('heading', { name: /Which language/ })).toBeVisible();
	await page.getByRole('button', { name: /^Start/ }).click();
	await expect(page.getByText(exercise.prompt)).toBeVisible();
	expect(exerciseBodies[0]).toMatchObject({
		sourceLanguage: { name: 'English', locale: 'en' },
		targetLanguage: { name: 'German', locale: 'de' },
		directions: ['target_to_source', 'source_to_target']
	});

	await page.getByRole('button', { name: 'Obwohl' }).click();
	await expect(page.getByRole('heading', { name: 'Obwohl' })).toBeVisible();
	await expect(page.getByText('although', { exact: true })).toBeVisible();
	const practiceBox = await page.locator('.practice-pane').boundingBox();
	const referenceBox = await page.getByRole('complementary', { name: 'Word reference' }).boundingBox();
	expect(practiceBox).not.toBeNull();
	expect(referenceBox).not.toBeNull();
	const viewport = page.viewportSize();
	if ((viewport?.width ?? 0) > (viewport?.height ?? 0)) {
		expect(referenceBox!.x).toBeGreaterThan(practiceBox!.x);
	} else {
		expect(referenceBox!.y).toBeGreaterThan(practiceBox!.y);
		expect(referenceBox!.height).toBeGreaterThan((viewport?.height ?? 0) * 0.4);
		expect(referenceBox!.height).toBeLessThan((viewport?.height ?? 0) * 0.65);
		expect(referenceBox!.y).toBeLessThan((viewport?.height ?? 0) * 0.65);
	}
	await page.screenshot({ path: testInfo.outputPath('reference-layout.png') });
	await page.getByRole('button', { name: 'Close word reference' }).click();

	await page.getByLabel('Your translation').fill('Although it is late, I will call her tomorrow.');
	await page.getByRole('button', { name: /Check answer/ }).click();
	await expect(page.getByText('Small repair')).toBeVisible();
	await page.getByRole('button', { name: 'tomorrow' }).click();
	await expect(page.getByText('This changes when the call happens.')).toBeVisible();

	await page.getByRole('button', { name: /Revise answer/ }).click();
	await page.getByLabel('Your translation').fill('Although it is late, I will still call her.');
	await page.getByRole('button', { name: /Check answer/ }).click();
	await expect(page.getByText('Correct', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: /Next sentence/ })).toBeVisible();
	await page.getByRole('button', { name: /Next sentence/ }).click();
	await expect.poll(() => exerciseBodies.length).toBe(2);
	expect(exerciseBodies[1]?.previousDirection).toBe('target_to_source');
});
