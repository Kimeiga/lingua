import { expect, test } from '@playwright/test';

const exercise = {
	id: 'exercise-1',
	stateToken: 'mock-state',
	targetLanguage: 'German',
	targetLocale: 'de',
	direction: 'target_to_english',
	cefr: 'B1',
	situation: 'Calling someone even though it is late',
	prompt: 'Obwohl es spät ist, rufe ich sie noch an.'
};

test('starts German practice, teaches a repair, and opens the word pane', async ({ page }, testInfo) => {
	let checks = 0;
	await page.route('**/api/exercise', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(exercise) }));
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
});
