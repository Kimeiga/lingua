<!--
THESIS: The learner's sentence is the product; controls and explanations recede until they are needed.
SIGNATURE: A living sentence line turns every generated word into the handle for its own study note.
LAYOUT: One full-height practice stage splits right in landscape and below in portrait when a reference opens.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { ArrowRight, Check, LoaderCircle, RotateCcw, Settings2, XCircle } from '@lucide/svelte';
	import ReferencePane from '$lib/ReferencePane.svelte';
	import {
		defaultProfile,
		type Direction,
		type EvaluationResult,
		type LearnerProfile,
		type PublicExercise,
		type TutorIssue
	} from '$lib/contracts';
	import { languageFromName, languages } from '$lib/languages';

	type Screen = 'setup' | 'loading' | 'practice';
	type TextPiece = { text: string; wordLike: boolean; start: number; issue: TutorIssue | null; issueIndex: number };

	let screen = $state<Screen>('setup');
	let targetLanguageName = $state('German');
	let targetToEnglish = $state(true);
	let englishToTarget = $state(true);
	let exercise = $state<PublicExercise | null>(null);
	let answer = $state('');
	let result = $state<EvaluationResult | null>(null);
	let editing = $state(true);
	let checking = $state(false);
	let requestError = $state('');
	let attempt = $state(1);
	let priorHints = $state<string[]>([]);
	let profile = $state<LearnerProfile>({ ...defaultProfile });
	let clientId = $state('');
	let referenceOpen = $state(false);
	let referenceQuery = $state('');
	let referenceScope = $state<'source' | 'answer'>('source');
	let settingsOpen = $state(false);
	let selectedIssue = $state<number | null>(null);
	let loadingLine = $state(0);
	let answerField = $state<HTMLTextAreaElement>();
	let shortcutKey = $state('Ctrl');

	const loadingLines = [
		'Finding a sentence worth saying',
		'Checking its natural translations',
		'Preparing the word notes'
	];

	const selectedDirections = $derived([
		...(targetToEnglish ? ['target_to_english' as Direction] : []),
		...(englishToTarget ? ['english_to_target' as Direction] : [])
	]);
	const directionLabel = $derived(exercise?.direction === 'target_to_english'
		? `${exercise.targetLanguage} → English`
		: exercise ? `English → ${exercise.targetLanguage}` : '');
	const promptPieces = $derived(exercise ? segmentText(exercise.prompt, exercise.direction === 'target_to_english' ? exercise.targetLocale : 'en') : []);
	const answerPieces = $derived(exercise ? buildAnswerPieces(answer, result?.issues ?? [], exercise.direction === 'english_to_target' ? exercise.targetLocale : 'en') : []);

	onMount(() => {
		shortcutKey = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';
		clientId = localStorage.getItem('lingua-client-id') || crypto.randomUUID().replaceAll('-', '');
		localStorage.setItem('lingua-client-id', clientId);
		try {
			const savedSettings = JSON.parse(localStorage.getItem('lingua-settings-v1') || '{}') as Record<string, unknown>;
			if (typeof savedSettings.language === 'string') targetLanguageName = savedSettings.language;
			if (typeof savedSettings.targetToEnglish === 'boolean') targetToEnglish = savedSettings.targetToEnglish;
			if (typeof savedSettings.englishToTarget === 'boolean') englishToTarget = savedSettings.englishToTarget;
			if (!targetToEnglish && !englishToTarget) targetToEnglish = true;
			const savedProfile = JSON.parse(localStorage.getItem('lingua-profile-v1') || 'null');
			if (savedProfile) profile = sanitizeStoredProfile(savedProfile);
		} catch {
			profile = { ...defaultProfile };
		}
	});

	function sanitizeStoredProfile(value: unknown): LearnerProfile {
		const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
		const list = (item: unknown, max: number, length: number) => Array.isArray(item)
			? item.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.slice(0, length)).slice(0, max)
			: [];
		return {
			level: Math.max(1, Math.min(5, Math.round(Number(record.level) || 3))),
			observedLevel: typeof record.observedLevel === 'string' ? record.observedLevel.slice(0, 48) : 'Intermediate',
			strengths: list(record.strengths, 4, 80),
			focus: list(record.focus, 4, 80),
			attempts: Math.max(0, Number(record.attempts) || 0),
			correct: Math.max(0, Number(record.correct) || 0),
			recentPrompts: list(record.recentPrompts, 4, 240)
		};
	}

	function persist() {
		localStorage.setItem('lingua-settings-v1', JSON.stringify({ language: targetLanguageName, targetToEnglish, englishToTarget }));
		localStorage.setItem('lingua-profile-v1', JSON.stringify(profile));
	}

	async function startSession() {
		if (!targetLanguageName.trim() || selectedDirections.length === 0 || !clientId) return;
		persist();
		settingsOpen = false;
		await loadExercise();
	}

	async function loadExercise() {
		const previous = exercise;
		screen = 'loading';
		requestError = '';
		answer = '';
		result = null;
		editing = true;
		attempt = 1;
		priorHints = [];
		selectedIssue = null;
		closeReference();
		const interval = window.setInterval(() => loadingLine = (loadingLine + 1) % loadingLines.length, 1650);
		try {
			const language = languageFromName(targetLanguageName);
			const response = await fetch('/api/exercise', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ language, directions: selectedDirections, profile, clientId })
			});
			const payload = await response.json() as PublicExercise & { message?: string };
			if (!response.ok) throw new Error(payload.message || 'The tutor could not prepare a sentence.');
			exercise = payload;
			profile.recentPrompts = [payload.prompt, ...profile.recentPrompts.filter((item) => item !== payload.prompt)].slice(0, 4);
			persist();
			screen = 'practice';
			await tick();
			answerField?.focus();
		} catch (cause) {
			requestError = cause instanceof Error ? cause.message : 'The tutor could not prepare a sentence.';
			exercise = previous;
			screen = previous ? 'practice' : 'setup';
		} finally {
			window.clearInterval(interval);
		}
	}

	async function checkAnswer() {
		if (!exercise || !answer.trim() || checking || !editing) return;
		checking = true;
		requestError = '';
		selectedIssue = null;
		try {
			const response = await fetch('/api/evaluate', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					stateToken: exercise.stateToken,
					answer,
					attempt,
					priorHints,
					profile,
					clientId
				})
			});
			const payload = await response.json() as EvaluationResult & { message?: string };
			if (!response.ok) throw new Error(payload.message || 'The tutor could not check that answer.');
			result = payload;
			editing = false;
			if (payload.hint) priorHints = [...priorHints, payload.hint].slice(-3);
			profile = {
				...profile,
				level: Math.max(1, Math.min(5, profile.level + payload.learnerUpdate.difficultyDelta)),
				observedLevel: payload.learnerUpdate.observedLevel,
				strengths: payload.learnerUpdate.strengths,
				focus: payload.learnerUpdate.focus,
				attempts: profile.attempts + 1,
				correct: profile.correct + (payload.status === 'correct' ? 1 : 0)
			};
			persist();
		} catch (cause) {
			requestError = cause instanceof Error ? cause.message : 'The tutor could not check that answer.';
		} finally {
			checking = false;
		}
	}

	async function reviseAnswer() {
		editing = true;
		attempt += 1;
		await tick();
		answerField?.focus();
		answerField?.setSelectionRange(answer.length, answer.length);
	}

	function openReference(text: string, scope: 'source' | 'answer') {
		const cleaned = text.replace(/^[\s.,!?。，！？、;:¿¡„“”'’]+|[\s.,!?。，！？、;:¿¡„“”'’]+$/gu, '');
		if (!cleaned || !exercise) return;
		referenceQuery = cleaned;
		referenceScope = scope;
		referenceOpen = true;
	}

	function closeReference() {
		referenceOpen = false;
		referenceQuery = '';
	}

	function inspectTextareaSelection(event: MouseEvent) {
		const field = event.currentTarget as HTMLTextAreaElement;
		const selected = field.value.slice(field.selectionStart, field.selectionEnd).trim();
		if (selected && selected.length <= 120) openReference(selected, 'answer');
	}

	function resizeAnswer(event: Event) {
		const field = event.currentTarget as HTMLTextAreaElement;
		field.style.height = 'auto';
		field.style.height = `${Math.min(Math.max(field.scrollHeight, 120), 330)}px`;
	}

	function segmentText(value: string, locale: string): TextPiece[] {
		if (!value) return [];
		try {
			const segments = [...new Intl.Segmenter(locale === 'und' ? undefined : locale, { granularity: 'word' }).segment(value)];
			return segments.map((segment) => ({
				text: segment.segment,
				wordLike: Boolean(segment.isWordLike),
				start: segment.index,
				issue: null,
				issueIndex: -1
			}));
		} catch {
			let cursor = 0;
			return value.split(/(\s+)/u).filter(Boolean).map((text) => {
				const piece = { text, wordLike: !/^\s+$/u.test(text), start: cursor, issue: null, issueIndex: -1 };
				cursor += text.length;
				return piece;
			});
		}
	}

	function nthIndexOf(value: string, needle: string, occurrence: number): number {
		let from = 0;
		for (let count = 1; count <= occurrence; count += 1) {
			const found = value.indexOf(needle, from);
			if (found < 0) return -1;
			if (count === occurrence) return found;
			from = found + needle.length;
		}
		return -1;
	}

	function buildAnswerPieces(value: string, issues: TutorIssue[], locale: string): TextPiece[] {
		const located = issues.map((issue, issueIndex) => {
			const start = nthIndexOf(value, issue.text, issue.occurrence);
			return { issue, issueIndex, start, end: start + issue.text.length };
		}).filter((item) => item.start >= 0);
		return segmentText(value, locale).map((piece) => {
			const match = located.find((item) => item.start < piece.start + piece.text.length && item.end > piece.start);
			return match ? { ...piece, issue: match.issue, issueIndex: match.issueIndex } : piece;
		});
	}

	function handleKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
			event.preventDefault();
			void checkAnswer();
		}
		if (event.key === 'Escape') {
			if (referenceOpen) closeReference();
			else settingsOpen = false;
		}
	}
</script>

<svelte:head>
	<title>Lingua — learn by translating</title>
	<meta name="description" content="Adaptive translation practice for any language, with precise hints and word-by-word study notes." />
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

{#if screen === 'setup'}
	<div class="setup-shell">
		<header class="brand-bar">
			<a class="brand" href="/" aria-label="Lingua home"><span>li</span>ngua</a>
			<span class="edition">translation fieldwork · 01</span>
		</header>

		<main class="setup-main">
			<section class="setup-copy">
				<p class="eyebrow">A daily language practice</p>
				<h1>Which language<br />are you learning?</h1>
				<p class="intro">Translate one useful sentence. Revise it with small hints. Open any word when you want to understand how it works.</p>
			</section>

			<form class="setup-form" onsubmit={(event) => { event.preventDefault(); void startSession(); }}>
				<label class="language-label" for="target-language">Target language</label>
				<input id="target-language" list="language-list" bind:value={targetLanguageName} autocomplete="off" required />
				<datalist id="language-list">
					{#each languages as language}
						<option value={language.name}>{language.nativeName}</option>
					{/each}
				</datalist>

				<fieldset>
					<legend>Practice directions</legend>
					<label class="direction-choice">
						<span><strong>{targetLanguageName || 'Target language'}</strong><small>into English</small></span>
						<input type="checkbox" bind:checked={targetToEnglish} />
					</label>
					<label class="direction-choice">
						<span><strong>English</strong><small>into {targetLanguageName || 'the target language'}</small></span>
						<input type="checkbox" bind:checked={englishToTarget} />
					</label>
				</fieldset>

				{#if selectedDirections.length === 0}<p class="form-note error-text">Keep at least one direction on.</p>{/if}
				{#if requestError}<p class="form-note error-text" role="alert">{requestError}</p>{/if}
				<button class="primary-action" type="submit" disabled={!targetLanguageName.trim() || selectedDirections.length === 0 || !clientId}>
					Start <ArrowRight size={20} strokeWidth={1.8} />
				</button>
			</form>
		</main>
	</div>
{:else if screen === 'loading'}
	<main class="loading-screen" aria-live="polite">
		<a class="brand loading-brand" href="/"><span>li</span>ngua</a>
		<div class="loading-copy">
			<LoaderCircle class="spinner" size={28} strokeWidth={1.5} />
			<p>{loadingLines[loadingLine]}</p>
			<span>{targetLanguageName} · intermediate</span>
		</div>
	</main>
{:else if exercise}
	<div class="practice-shell">
		<header class="practice-bar">
			<a class="brand" href="/" aria-label="Lingua home"><span>li</span>ngua</a>
			<div class="session-meta">
				<span>{profile.observedLevel}</span>
				<strong>{profile.correct} complete</strong>
			</div>
			<button class="settings-button" type="button" onclick={() => settingsOpen = !settingsOpen} aria-expanded={settingsOpen}>
				<Settings2 size={18} strokeWidth={1.8} /> <span>Session</span>
			</button>
		</header>

		{#if settingsOpen}
			<section class="session-settings" aria-label="Session settings">
				<label>Target language <input list="language-list-settings" bind:value={targetLanguageName} /></label>
				<datalist id="language-list-settings">
					{#each languages as language}<option value={language.name}>{language.nativeName}</option>{/each}
				</datalist>
				<label class="mini-toggle"><input type="checkbox" bind:checked={targetToEnglish} /> {targetLanguageName} → English</label>
				<label class="mini-toggle"><input type="checkbox" bind:checked={englishToTarget} /> English → {targetLanguageName}</label>
				<button type="button" onclick={() => void startSession()} disabled={!targetLanguageName.trim() || selectedDirections.length === 0}>Apply and get a new sentence</button>
				{#if selectedDirections.length === 0}<span class="settings-warning">Choose at least one direction.</span>{/if}
			</section>
		{/if}

		<div class:with-reference={referenceOpen} class="workspace">
			<main class="practice-pane">
				<div class="task-heading">
					<div>
						<span class="task-number">Sentence {profile.correct + 1}</span>
						<h1>Translate into {exercise.direction === 'target_to_english' ? 'English' : exercise.targetLanguage}</h1>
					</div>
					<div class="direction-mark"><span>{directionLabel}</span><small>{exercise.cefr}</small></div>
				</div>

				<section class="sentence-stage" aria-label="Sentence to translate">
					<p class="situation">{exercise.situation}</p>
					<div class="prompt" lang={exercise.direction === 'target_to_english' && exercise.targetLocale !== 'und' ? exercise.targetLocale : 'en'}>
						{#each promptPieces as piece}
							{#if piece.wordLike}
								<button type="button" onclick={() => openReference(piece.text, 'source')}>{piece.text}</button>
							{:else}{piece.text}{/if}
						{/each}
					</div>
					<p class="word-instruction">Select a prompt word to open its note.</p>
				</section>

				<section class="answer-stage" class:has-result={result && !editing}>
					<label for="answer">Your translation</label>
					{#if editing}
						<textarea
							id="answer"
							bind:this={answerField}
							bind:value={answer}
							oninput={resizeAnswer}
							ondblclick={inspectTextareaSelection}
							lang={exercise.direction === 'english_to_target' && exercise.targetLocale !== 'und' ? exercise.targetLocale : undefined}
							placeholder="Write the sentence here…"
							aria-describedby="answer-help"
							maxlength="1600"
						></textarea>
						<p id="answer-help" class="answer-help">Double-click a word you wrote to inspect it.</p>
					{:else}
						<div class="rendered-answer" aria-label="Your checked translation">
							{#each answerPieces as piece}
								{#if piece.issue && piece.wordLike}
									<button
										type="button"
										class="issue-word"
										title={piece.issue.tooltip}
										onclick={() => selectedIssue = selectedIssue === piece.issueIndex ? null : piece.issueIndex}
									>{piece.text}</button>
								{:else if piece.wordLike}
									<button type="button" class="answer-word" onclick={() => openReference(piece.text, 'answer')}>{piece.text}</button>
								{:else}{piece.text}{/if}
							{/each}
							{#if result?.status === 'retry'}<XCircle class="retry-x" size={35} strokeWidth={1.8} aria-label="Try again" />{/if}
						</div>
					{/if}

					{#if selectedIssue !== null && result?.issues[selectedIssue]}
						<div class="issue-detail" role="note">
							<strong>{result.issues[selectedIssue].tooltip}</strong>
							<p>{result.issues[selectedIssue].detail}</p>
						</div>
					{/if}

					{#if result && result.status !== 'correct'}
						<div class="hint-line">
							<span>{result.status === 'repairable' ? 'Small repair' : 'Next clue'}</span>
							<p>{result.hint}</p>
						</div>
					{/if}

					{#if requestError}<p class="request-error" role="alert">{requestError}</p>{/if}

					<div class="answer-actions">
						{#if editing}
							<span>{shortcutKey} + Enter to check</span>
							<button class="check-button" type="button" onclick={() => void checkAnswer()} disabled={!answer.trim() || checking}>
								{#if checking}<LoaderCircle class="spinner" size={18} /> Checking{:else}Check answer <ArrowRight size={18} />{/if}
							</button>
						{:else if result?.status !== 'correct'}
							<span>Attempt {attempt}</span>
							<button class="check-button" type="button" onclick={() => void reviseAnswer()}><RotateCcw size={17} /> Revise answer</button>
						{/if}
					</div>
				</section>

				{#if result?.status === 'correct'}
					<section class="correct-section">
						<div class="correct-heading"><Check size={24} strokeWidth={2} /><div><span>Correct</span><p>{result.summary}</p></div></div>
						<div class="grammar-list">
							{#each result.grammarPoints as point, index}
								<article>
									<span>{String(index + 1).padStart(2, '0')}</span>
									<div><h2>{point.title}</h2><p>{point.explanation}</p>{#if point.pattern}<code>{point.pattern}</code>{/if}</div>
								</article>
							{/each}
						</div>
						<button class="next-button" type="button" onclick={() => void loadExercise()}>Next sentence <ArrowRight size={19} /></button>
					</section>
				{/if}
			</main>

			{#if referenceOpen}
				<ReferencePane query={referenceQuery} stateToken={exercise.stateToken} scope={referenceScope} language={exercise.targetLanguage} locale={exercise.targetLocale} onclose={closeReference} />
			{/if}
		</div>
	</div>
{/if}

<style>
	.setup-shell,
	.practice-shell,
	.loading-screen {
		min-height: 100dvh;
		background: var(--paper);
	}

	.brand-bar,
	.practice-bar {
		display: flex;
		height: 4.75rem;
		align-items: center;
		justify-content: space-between;
		padding: 0 clamp(1.25rem, 4vw, 3.5rem);
		border-bottom: 1px solid var(--line);
	}

	.brand {
		color: var(--ink);
		font-size: 1.08rem;
		font-weight: 650;
		letter-spacing: -0.025em;
		text-decoration: none;
	}

	.brand span {
		display: inline-grid;
		width: 1.9rem;
		height: 1.9rem;
		margin-right: 0.35rem;
		place-items: center;
		background: var(--ink);
		color: var(--paper);
		font: 0.75rem var(--mono);
		letter-spacing: -0.08em;
	}

	.edition,
	.eyebrow,
	.language-label,
	fieldset legend,
	.task-number,
	.direction-mark,
	.answer-stage > label,
	.answer-actions > span,
	.word-instruction,
	.hint-line > span,
	.correct-heading span {
		font: 0.7rem/1.3 var(--mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.edition { color: var(--muted); }

	.setup-main {
		display: grid;
		min-height: calc(100dvh - 4.75rem);
		grid-template-columns: minmax(0, 1.2fr) minmax(22rem, 0.8fr);
	}

	.setup-copy {
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: clamp(3rem, 8vw, 8rem);
		border-right: 1px solid var(--line);
	}

	.eyebrow {
		margin: 0 0 1.5rem;
		color: var(--blue);
	}

	.setup-copy h1 {
		max-width: 13ch;
		margin: 0;
		font-size: clamp(3.3rem, 7.2vw, 7rem);
		font-weight: 510;
		letter-spacing: -0.065em;
		line-height: 0.92;
	}

	.intro {
		max-width: 34rem;
		margin: 2.25rem 0 0;
		color: var(--muted);
		font-size: clamp(1rem, 1.5vw, 1.18rem);
		line-height: 1.6;
	}

	.setup-form {
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: clamp(2rem, 6vw, 5rem);
		background: #eef3ef;
	}

	.language-label,
	fieldset legend { color: var(--muted); }

	.setup-form > input,
	.session-settings input[list] {
		width: 100%;
		margin: 0.65rem 0 2.5rem;
		padding: 0.45rem 0 0.65rem;
		border: 0;
		border-bottom: 2px solid var(--ink);
		border-radius: 0;
		background: transparent;
		color: var(--ink);
		font-size: clamp(2rem, 4vw, 3.2rem);
		font-weight: 520;
		letter-spacing: -0.04em;
	}

	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
	}

	fieldset legend { margin-bottom: 0.7rem; }

	.direction-choice {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.15rem 0;
		border-top: 1px solid var(--line);
		cursor: pointer;
	}

	.direction-choice:last-of-type { border-bottom: 1px solid var(--line); }
	.direction-choice span { display: grid; gap: 0.15rem; }
	.direction-choice strong { font-weight: 560; }
	.direction-choice small { color: var(--muted); font-size: 0.83rem; }

	.direction-choice input,
	.mini-toggle input {
		width: 1.25rem;
		height: 1.25rem;
		accent-color: var(--blue);
	}

	.primary-action,
	.check-button,
	.next-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.65rem;
		border: 0;
		background: var(--ink);
		color: var(--paper);
		cursor: pointer;
		font-weight: 560;
	}

	.primary-action {
		align-self: flex-start;
		min-width: 10rem;
		margin-top: 2.25rem;
		padding: 0.9rem 1.15rem;
	}

	.primary-action:hover,
	.check-button:hover,
	.next-button:hover { background: var(--blue); }
	.primary-action:disabled,
	.check-button:disabled { cursor: not-allowed; opacity: 0.4; }

	.form-note { margin: 0.8rem 0 0; font-size: 0.86rem; }
	.error-text,
	.request-error { color: #b42f36; }

	.loading-screen {
		display: grid;
		place-items: center;
	}

	.loading-brand { position: absolute; top: 1.4rem; left: clamp(1.25rem, 4vw, 3.5rem); }
	.loading-copy { display: grid; justify-items: center; gap: 1rem; text-align: center; }
	.loading-copy p { margin: 0.5rem 0 0; font-size: clamp(1.4rem, 4vw, 2.4rem); letter-spacing: -0.04em; }
	.loading-copy span { font: 0.7rem var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
	:global(.spinner) { animation: spin 0.9s linear infinite; }

	.practice-shell {
		display: grid;
		height: 100dvh;
		grid-template-rows: auto auto minmax(0, 1fr);
	}

	.practice-bar { height: 4.25rem; }
	.session-meta { display: flex; align-items: center; gap: 0.6rem; color: var(--muted); font: 0.68rem var(--mono); text-transform: uppercase; letter-spacing: 0.06em; }
	.session-meta span::after { content: '·'; margin-left: 0.6rem; }
	.session-meta strong { color: var(--ink); font-weight: 400; }
	.settings-button { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.6rem 0; border: 0; background: transparent; cursor: pointer; color: var(--muted); }
	.settings-button:hover { color: var(--blue); }

	.session-settings {
		display: grid;
		grid-template-columns: minmax(12rem, 1fr) auto auto auto;
		align-items: center;
		gap: 1.2rem;
		padding: 1rem clamp(1.25rem, 4vw, 3.5rem);
		border-bottom: 1px solid var(--line);
		background: var(--mist);
		font-size: 0.82rem;
	}

	.session-settings > label:first-child { display: grid; gap: 0.3rem; color: var(--muted); }
	.session-settings input[list] { margin: 0; padding: 0.2rem 0; border-width: 1px; font-size: 1.05rem; }
	.mini-toggle { display: flex; align-items: center; gap: 0.45rem; white-space: nowrap; }
	.session-settings button { padding: 0.75rem 0.9rem; border: 1px solid var(--ink); background: transparent; cursor: pointer; }
	.session-settings button:hover { background: var(--ink); color: var(--paper); }
	.session-settings button:disabled { opacity: 0.4; cursor: not-allowed; }
	.settings-warning { color: var(--error); }

	.workspace {
		display: grid;
		min-width: 0;
		min-height: 0;
		grid-template-rows: minmax(0, 1fr);
	}

	.workspace.with-reference { grid-template-rows: minmax(15rem, 1fr) minmax(45dvh, 50dvh); }
	.practice-pane { min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }

	.task-heading {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 2rem;
		padding: clamp(1.6rem, 4vw, 3rem) clamp(1.25rem, 5vw, 4rem) 1.4rem;
		border-bottom: 1px solid var(--line);
	}

	.task-number { color: var(--blue); }
	.task-heading h1 { margin: 0.45rem 0 0; font-size: clamp(1.2rem, 2.2vw, 1.65rem); font-weight: 580; letter-spacing: -0.025em; }
	.direction-mark { display: grid; justify-items: end; gap: 0.3rem; color: var(--muted); text-align: right; }
	.direction-mark small { font: 0.65rem var(--mono); color: var(--blue); }

	.sentence-stage,
	.answer-stage,
	.correct-section {
		padding: clamp(2.2rem, 6vw, 5.4rem) clamp(1.25rem, 5vw, 4rem);
	}

	.sentence-stage { border-bottom: 1px solid var(--line); }
	.situation { max-width: 54rem; margin: 0 0 1.3rem; color: var(--muted); font-size: 0.9rem; }
	.prompt { max-width: 23ch; font-size: clamp(2.3rem, 5.3vw, 5.7rem); font-weight: 500; letter-spacing: -0.055em; line-height: 1.12; }
	.prompt button,
	.answer-word,
	.issue-word { display: inline; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; letter-spacing: inherit; line-height: inherit; text-align: inherit; }
	.prompt button { border-bottom: 1px solid transparent; transition: color 140ms ease, border-color 140ms ease, transform 140ms ease; }
	.prompt button:hover { border-bottom-color: var(--blue); color: var(--blue); transform: translateY(-0.06em); }
	.word-instruction { margin: 1.5rem 0 0; color: var(--muted); }

	.answer-stage { position: relative; }
	.answer-stage > label { display: block; margin-bottom: 1rem; color: var(--muted); }
	textarea { display: block; width: 100%; min-height: 8rem; resize: none; overflow-y: auto; padding: 0 3.5rem 0.75rem 0; border: 0; border-bottom: 2px solid var(--ink); border-radius: 0; background: transparent; color: var(--ink); font-size: clamp(2rem, 4.7vw, 4.9rem); font-weight: 490; letter-spacing: -0.05em; line-height: 1.18; }
	textarea::placeholder { color: #a8b3ad; }
	textarea:focus-visible { outline: 0; border-bottom-color: var(--blue); }
	.answer-help { margin: 0.7rem 0 0; color: var(--muted); font-size: 0.76rem; }

	.rendered-answer { position: relative; max-width: 24ch; padding-right: 3rem; font-size: clamp(2rem, 4.7vw, 4.9rem); font-weight: 490; letter-spacing: -0.05em; line-height: 1.2; }
	.answer-word:hover { color: var(--blue); }
	.issue-word { color: var(--error); text-decoration: underline; text-decoration-thickness: 0.08em; text-underline-offset: 0.13em; }
	:global(.retry-x) { position: absolute; right: 0; top: 0.18em; color: var(--error); }
	.issue-detail { max-width: 46rem; margin-top: 1.5rem; padding: 1.15rem 1.3rem; border-left: 3px solid var(--error); background: color-mix(in srgb, var(--error) 7%, transparent); }
	.issue-detail strong { font-weight: 600; }
	.issue-detail p { margin: 0.4rem 0 0; color: var(--muted); line-height: 1.55; }
	.hint-line { display: grid; max-width: 48rem; grid-template-columns: 7rem 1fr; gap: 1rem; margin-top: 2rem; padding-top: 1.2rem; border-top: 1px solid var(--line); }
	.hint-line span { color: var(--error); }
	.hint-line p { margin: 0; line-height: 1.55; }
	.request-error { max-width: 48rem; margin: 1.2rem 0 0; }
	.answer-actions { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 2rem; }
	.answer-actions > span { color: var(--muted); }
	.check-button { min-width: 10.5rem; padding: 0.8rem 1rem; }

	.correct-section { border-top: 1px solid var(--line); background: #eef3ef; }
	.correct-heading { display: flex; align-items: flex-start; gap: 0.9rem; color: var(--correct); }
	.correct-heading div { display: grid; gap: 0.3rem; }
	.correct-heading p { margin: 0; color: var(--ink); font-size: 1.05rem; }
	.grammar-list { max-width: 52rem; margin: 2rem 0; border-top: 1px solid var(--line); }
	.grammar-list article { display: grid; grid-template-columns: 3rem 1fr; gap: 1rem; padding: 1.4rem 0; border-bottom: 1px solid var(--line); }
	.grammar-list article > span { font: 0.72rem var(--mono); color: var(--blue); }
	.grammar-list h2 { margin: 0; font-size: 1.05rem; font-weight: 620; }
	.grammar-list p { margin: 0.45rem 0 0; color: var(--muted); line-height: 1.55; }
	.grammar-list code { display: inline-block; margin-top: 0.8rem; font: 0.8rem var(--mono); }
	.next-button { padding: 0.9rem 1.1rem; }

	@keyframes spin { to { transform: rotate(360deg); } }

	@media (orientation: landscape) and (min-width: 760px) {
		.workspace.with-reference { grid-template-columns: minmax(0, 1.65fr) minmax(21rem, 0.72fr); grid-template-rows: minmax(0, 1fr); }
		.workspace.with-reference .prompt { font-size: clamp(2.1rem, 3.9vw, 4.8rem); }
		.workspace.with-reference textarea,
		.workspace.with-reference .rendered-answer { font-size: clamp(1.8rem, 3.4vw, 3.9rem); }
	}

	@media (max-width: 820px) {
		.setup-main { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
		.setup-copy { padding: 3rem clamp(2rem, 9vw, 5rem); border-right: 0; border-bottom: 1px solid var(--line); }
		.setup-form { padding: 2.5rem clamp(2rem, 9vw, 5rem); }
		.session-settings { grid-template-columns: 1fr; align-items: start; }
		.session-settings button { justify-self: start; }
	}

	@media (max-width: 600px) {
		.brand-bar,
		.practice-bar { padding-inline: 1rem; }
		.brand-bar { height: 3.75rem; }
		.setup-main {
			min-height: calc(100svh - 3.75rem);
			grid-template-rows: auto minmax(0, 1fr);
		}
		.setup-copy { padding: 1.15rem 1.25rem 1.1rem; }
		.eyebrow { margin-bottom: 0.55rem; font-size: 0.62rem; }
		.setup-copy h1 {
			max-width: none;
			font-size: clamp(2.45rem, 11vw, 3rem);
			line-height: 0.94;
		}
		.intro {
			max-width: 29rem;
			margin-top: 0.85rem;
			font-size: 0.88rem;
			line-height: 1.42;
		}
		.setup-form {
			justify-content: flex-start;
			padding: 1rem 1.25rem max(1rem, env(safe-area-inset-bottom));
		}
		.setup-form > input {
			margin: 0.3rem 0 1rem;
			padding: 0.2rem 0 0.45rem;
			font-size: 1.75rem;
		}
		fieldset legend { margin-bottom: 0.35rem; }
		.direction-choice { padding: 0.65rem 0; }
		.primary-action {
			width: 100%;
			min-height: 2.75rem;
			margin-top: 0.9rem;
			padding: 0.7rem 1rem;
		}
		.edition,
		.session-meta { display: none; }
		.settings-button span { display: none; }
		.task-heading { align-items: flex-start; }
		.direction-mark { max-width: 9rem; }
		.prompt { max-width: 100%; }
		.hint-line { grid-template-columns: 1fr; gap: 0.45rem; }
		.answer-actions { align-items: flex-end; }
		.answer-actions > span { max-width: 7rem; }
	}
</style>
