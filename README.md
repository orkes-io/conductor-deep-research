# Deep research agents on Conductor

A deep research system built from [Conductor](https://github.com/conductor-oss/conductor) workflows. You give it a topic and a goal, and it:

1. plans the research by splitting the goal into areas, one per research agent
2. runs one `research_area` workflow per area, all in parallel
3. in every round, has a researcher on one LLM provider search the web and report claims with sources, while a reviewer on a *different* provider searches too and tries to refute each claim
4. writes a report from the claims that survive review and renders it as a PDF

A small React app starts runs, shows each agent's progress and claims, lists past runs, and downloads the PDF.

It uses OpenAI, Anthropic and Google Gemini models through Conductor's built-in `LLM_CHAT_COMPLETE` task with provider web search (`webSearch: true`). The orchestration is all built-in system tasks: `FORK_JOIN_DYNAMIC`, `DO_WHILE`, `SUB_WORKFLOW`, `JSON_JQ_TRANSFORM`, `SET_VARIABLE` and `SWITCH`. The only code you run is the UI server, which also hosts one worker that renders the PDF.

## Prerequisites

- An [Orkes Developer Edition](https://developer.orkescloud.com) account (free), or any Orkes Conductor cluster
- An application with an access key: **Access Control > Applications > Create application**, then **Create access key**
- AI integrations, each with at least one model registered and your application granted access. Two providers are enough, because every reviewer only has to be a different provider than its researcher.
  - **OpenAI** (API key)
  - **Anthropic Claude** (API key, endpoint `https://api.anthropic.com/v1`)
  - **Google Gemini AI** (GCP project ID, location and a service account JSON with the Agent Platform API enabled)
- Node.js 20.6 or later

## Run it

```bash
git clone https://github.com/orkes-io/conductor-deep-research.git
cd conductor-deep-research
npm install
cp .env.example .env    # then fill in your server URL, key and secret
```

Edit `models.json` so each entry matches an integration name and a model registered under it in your cluster:

```json
[
  {"kind": "openai", "llmProvider": "openai", "model": "gpt-6.1-sol", "reasoningEffort": "low", "label": "GPT-6.1 Sol"},
  {"kind": "anthropic", "llmProvider": "anthropic", "model": "claude-sonnet-5", "label": "Claude Sonnet 5"},
  {"kind": "gemini", "llmProvider": "gemini", "model": "gemini-3-pro", "label": "Gemini 3 Pro"}
]
```

`kind` groups models by provider, so the fan-out never pairs a researcher with a reviewer of the same kind. `llmProvider` is the integration's name in Conductor, not the provider type.

Register the task definitions and workflows, then start the UI:

```bash
npm run register
npm run dev
```

Open http://localhost:5173, enter a topic and a goal, and start a run.

You can also start a run without the UI. The models go in the input:

```bash
conductor workflow start -w deep_research -i '{
  "topic": "Running open-weight LLMs on your own hardware in 2026",
  "goal": "Decide whether a 50-person engineering team should self-host a coding model",
  "numAreas": 4,
  "models": [ ...the entries from models.json... ]
}'
```

Without the UI server running, the run waits at the PDF step for up to an hour, then finishes with the markdown report in its output.

## How it works

| Workflow | What it does |
|---|---|
| `deep_research` | Plans the areas, fans out one `research_area` per area with `FORK_JOIN_DYNAMIC`, collects the results, has an editor write the summary, assembles the report and renders the PDF |
| `research_area` | One research agent. A `DO_WHILE` runs rounds of research and adversarial review and keeps a claim ledger in workflow variables. It stops when the reviewer is satisfied or the round cap is reached, then writes the area's section |
| `agent_turn` | One LLM call: builds the prompt, calls `LLM_CHAT_COMPLETE` and parses the JSON reply |

Each LLM call runs as its own small `agent_turn` workflow instead of sitting directly inside the `DO_WHILE`. Inside a loop, Conductor appends an LLM task's replies from earlier iterations to its next call's messages, and each turn here should only see the context it's given.

The source is split so it's easy to read and edit:

- `conductor/src/` holds the workflow definitions. A string like `"@include:prompts/reviewer.md"` pulls in another file.
- `conductor/prompts/` holds the planner, researcher, reviewer, section writer and editor prompts.
- `conductor/jq/` holds the `JSON_JQ_TRANSFORM` programs: the claim ledger, the stop rule and the report.
- `conductor/dist/` holds the generated definitions, with everything inlined. Rebuild them with `npm run build:defs` after you change anything in `conductor/`.
- `server/` holds the UI's API server and the PDF worker.
- `web/` holds the React app.

## Scaling and cost

The UI allows 1 to 30 research areas per run. A run makes about `2 + areas × (2 × rounds + 1)` LLM calls, and `2 × areas × rounds` of them use web search. Provider rate limits are usually the first thing you hit with wide runs. Every LLM task retries with exponential backoff, and one failed area doesn't fail the run: the report lists it under "Areas that did not complete".

## Notes

- **PDF:** Conductor's built-in `GENERATE_PDF` task saves the file where the server runs. On Orkes Developer Edition that is the server's own disk unless you give it an S3 or GCS bucket integration, so this project renders the PDF in a worker (`server/pdf.ts`) next to the UI instead.
- **Credentials:** your Conductor key and secret stay in the server's `.env`. The browser only talks to the local server, which listens on 127.0.0.1.
- **Web content:** the PDF renderer runs with JavaScript off and no network access, because the report contains text from web pages.
