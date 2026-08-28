# Lingua

Lingua is an adaptive translation practice app for any target language. GPT-5.6 Sol creates one intermediate daily-conversation sentence, its private answer lattice, and word-level study notes. The learner revises the answer until it is correct.

## Local setup

Use Node.js 22 or newer.

1. Copy `.env.example` to `.env.local`.
2. Set `OPENAI_API_KEY`, a random `TUTOR_STATE_SECRET`, and a random `RATE_LIMIT_SALT`.
3. Run `npm install`.
4. Run `npm run dev`.

`TUTOR_STATE_SECRET` encrypts the generated answer and study data that round-trip through the browser. `RATE_LIMIT_SALT` hashes the anonymous browser ID before it is used for OpenAI safety identifiers or usage counters.

## Quality and cost controls

- The generated answer lattice accepts multiple natural translations.
- Exact reference-answer matches skip the evaluation model call.
- Evaluation receives only the facts it needs, not the full word-reference payload.
- A generated exercise enters a small 30-day KV pool for the same language, direction, and level. The pool grows only when someone asks for that language, and recent prompts are never repeated in one browser.
- Cloudflare Rate Limiting caps bursts at 12 AI calls per minute per anonymous browser.
- Workers KV applies a 120-unit daily cap. Exercise generation costs three units; answer evaluation costs one.
- The OpenAI key exists only as a Cloudflare Worker secret.

KV counters are a cost guard, not an authentication system. A determined anonymous user can reset a browser ID. Set a hard project budget in OpenAI Platform before opening the app to untrusted public traffic.

## Deploy

The Worker deploys to `lingua.hakanalpay.com`.

```sh
npm run cf-typegen
npm run deploy
```

Set secrets before the first production request:

```sh
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put TUTOR_STATE_SECRET
npx wrangler secret put RATE_LIMIT_SALT
```
