<script lang="ts">
	import { Volume2, X } from '@lucide/svelte';
	import type { Lexeme, ReferenceResult } from '$lib/contracts';

	let {
		query,
		stateToken,
		scope,
		language,
		locale,
		onclose
	}: {
		query: string;
		stateToken: string;
		scope: 'source' | 'answer';
		language: string;
		locale: string;
		onclose: () => void;
	} = $props();

	let entries = $state<Lexeme[]>([]);
	let phase = $state<'loading' | 'ready' | 'empty' | 'error'>('loading');
	let requestId = 0;

	$effect(() => {
		const selected = query.trim();
		const token = stateToken;
		if (!selected || !token) return;
		void loadReference(selected, token, scope);
	});

	async function loadReference(selected: string, token: string, selectedScope: 'source' | 'answer') {
		const id = ++requestId;
		phase = 'loading';
		entries = [];
		try {
			const response = await fetch('/api/reference', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: selected, stateToken: token, scope: selectedScope })
			});
			const payload = await response.json() as ReferenceResult & { message?: string };
			if (!response.ok) throw new Error(payload.message || 'Reference unavailable');
			if (id !== requestId) return;
			entries = payload.entries;
			phase = entries.length ? 'ready' : 'empty';
		} catch {
			if (id === requestId) phase = 'error';
		}
	}

	function speak(text: string) {
		if (!('speechSynthesis' in window)) return;
		window.speechSynthesis.cancel();
		const utterance = new SpeechSynthesisUtterance(text);
		if (locale !== 'und') utterance.lang = locale;
		window.speechSynthesis.speak(utterance);
	}
</script>

<aside class="reference-pane" aria-label="Word reference">
	<header class="reference-header">
		<div>
			<span>Word note</span>
			<strong>{language}</strong>
		</div>
		<button type="button" onclick={onclose} aria-label="Close word reference"><X size={22} strokeWidth={1.7} /></button>
	</header>

	<div class="reference-scroll" aria-live="polite">
		{#if phase === 'loading'}
			<div class="reference-state">
				<span class="pulse-line"></span>
				<p>Finding <strong>{query}</strong> in this sentence…</p>
			</div>
		{:else if phase === 'ready'}
			{#each entries as entry, index}
				<article class="entry" class:secondary={index > 0}>
					<div class="entry-word">
						<div>
							<span class="entry-label">Selected form</span>
							<h2 lang={locale === 'und' ? undefined : locale}>{entry.surface}</h2>
							{#if entry.pronunciation}<p class="pronunciation">{entry.pronunciation}</p>{/if}
						</div>
						<button type="button" class="speak" onclick={() => speak(entry.surface)} aria-label={`Hear ${entry.surface}`}>
							<Volume2 size={20} strokeWidth={1.8} />
						</button>
					</div>

					<dl>
						<div class="definition">
							<dt>Meaning here</dt>
							<dd>{entry.definition}</dd>
						</div>
						<div>
							<dt>Dictionary form</dt>
							<dd>{entry.lemma}</dd>
						</div>
						<div>
							<dt>Form</dt>
							<dd>{entry.morphology || 'Base form'}</dd>
						</div>
						<div>
							<dt>Job in the sentence</dt>
							<dd>{entry.role}</dd>
						</div>
						{#if entry.note}
							<div>
								<dt>Usage note</dt>
								<dd>{entry.note}</dd>
							</div>
						{/if}
					</dl>
				</article>
			{/each}
		{:else}
			<div class="reference-state empty">
				<span>Selected text</span>
				<h2>{query}</h2>
				<p>{phase === 'error'
					? 'The sentence note could not be opened. Your practice answer is unchanged.'
					: 'This exact form is not in the generated sentence notes. Try the whole word or its dictionary form.'}</p>
			</div>
		{/if}
	</div>
</aside>

<style>
	.reference-pane {
		display: grid;
		min-width: 0;
		min-height: 0;
		grid-template-rows: auto minmax(0, 1fr);
		background: #eef3ef;
		color: var(--ink);
		border-top: 1px solid var(--ink);
	}

	.reference-header {
		display: flex;
		min-height: 5.25rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.9rem clamp(1rem, 4vw, 1.75rem);
		background: var(--ink);
		color: var(--paper);
	}

	.reference-header div {
		display: grid;
		gap: 0.15rem;
	}

	.reference-header span {
		font: 0.68rem/1.2 var(--mono);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		opacity: 0.62;
	}

	.reference-header strong {
		font-size: 1rem;
		font-weight: 560;
	}

	.reference-header button,
	.speak {
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		place-items: center;
		border: 0;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.reference-header button:hover {
		background: rgb(255 255 255 / 10%);
	}

	.reference-scroll {
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.entry {
		padding: clamp(1.5rem, 5vw, 2.5rem) clamp(1.2rem, 5vw, 2.25rem) 3rem;
	}

	.entry.secondary {
		border-top: 1px solid var(--line);
	}

	.entry-word {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--line);
	}

	.entry-label,
	dt,
	.reference-state > span {
		font: 0.68rem/1.3 var(--mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
	}

	h2 {
		margin: 0.25rem 0 0;
		font-size: clamp(2rem, 5vw, 3.25rem);
		font-weight: 560;
		letter-spacing: -0.045em;
	}

	.pronunciation {
		margin: 0.35rem 0 0;
		color: var(--muted);
	}

	.speak {
		flex: 0 0 auto;
		border: 1px solid var(--line);
		border-radius: 50%;
		color: var(--muted);
	}

	.speak:hover {
		border-color: var(--blue);
		color: var(--blue);
	}

	dl {
		margin: 0;
	}

	dl > div {
		display: grid;
		grid-template-columns: minmax(7.5rem, 0.36fr) 1fr;
		gap: 1rem;
		padding: 1.15rem 0;
		border-bottom: 1px solid var(--line);
	}

	dl > .definition {
		display: block;
		padding: 1.75rem 0;
	}

	dd {
		margin: 0;
		font-size: 0.98rem;
		line-height: 1.55;
	}

	.definition dd {
		margin-top: 0.5rem;
		font-size: clamp(1.2rem, 3vw, 1.55rem);
		line-height: 1.4;
	}

	.reference-state {
		display: grid;
		min-height: 14rem;
		place-content: center;
		justify-items: center;
		gap: 1rem;
		padding: 2rem;
		text-align: center;
		color: var(--muted);
	}

	.reference-state p {
		max-width: 29rem;
		margin: 0;
		line-height: 1.55;
	}

	.pulse-line {
		width: 3rem;
		height: 2px;
		background: var(--blue);
		animation: breathe 1.2s ease-in-out infinite;
	}

	.empty {
		justify-items: start;
		text-align: left;
	}

	.empty h2 {
		color: var(--ink);
	}

	@keyframes breathe {
		50% { transform: scaleX(1.75); opacity: 0.35; }
	}

	@media (orientation: landscape) and (min-width: 760px) {
		.reference-pane {
			border-top: 0;
			border-left: 1px solid var(--ink);
		}
	}

	@media (max-width: 520px) {
		dl > div {
			display: block;
		}

		dt {
			display: block;
			margin-bottom: 0.4rem;
		}
	}
</style>
