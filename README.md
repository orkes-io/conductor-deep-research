# Deep research agents on Conductor

A deep research system built from [Conductor](https://github.com/conductor-oss/conductor) workflows. You give it a topic and a goal, and it:

1. plans the research by splitting the goal into areas, one per research agent
2. runs one `research_area` workflow per area, all in parallel
3. in every round, has a researcher on one LLM provider search the web and report claims with sources, while a reviewer on a *different* provider searches too and tries to refute each claim
4. writes a report from the claims that survive review and renders it as a PDF

A small React app starts runs, shows each agent's progress and claims, lists past runs, and downloads the PDF.

It uses OpenAI, Anthropic and Mistral models, and every model call searches the web.

- OpenAI and Anthropic models run through Conductor's built-in `LLM_CHAT_COMPLETE` task with provider web search (`webSearch: true`). Google Gemini works the same way if you'd rather use it.
- Mistral models run through an `HTTP` task that calls Mistral's [Conversations API](https://docs.mistral.ai/studio/agents/agent-tools/websearch) with its `web_search` connector, because the built-in task's web search covers only OpenAI, Anthropic and Gemini.

The orchestration is all built-in system tasks: `FORK_JOIN_DYNAMIC`, `DO_WHILE`, `SUB_WORKFLOW`, `SWITCH`, `JSON_JQ_TRANSFORM` and `SET_VARIABLE`. The only code you run is the UI server, which also hosts one worker that renders the PDF.

## Prerequisites

- A free [Orkes Developer Edition](https://developer.orkescloud.com) account, the hosted Conductor service from Orkes
- An application with an access key: **Access Control > Applications > Create application**, then **Create access key**
- Access to at least two providers, because every reviewer has to be a different provider than its researcher:
  - **OpenAI**: an OpenAI integration under **Integrations > Connections and Resources** with your API key, and a model added under it
  - **Anthropic Claude**: an Anthropic Claude integration with your API key (endpoint `https://api.anthropic.com/v1`), and a model added under it
  - **Mistral**: a secret named `mistral_api_key` under **Definitions > Secrets** that holds your Mistral API key
- Your application needs access to each integration's models and to the secret.
- Node.js 20.6 or later

## Run it

```bash
git clone https://github.com/orkes-io/conductor-deep-research.git
cd conductor-deep-research
npm install
cp .env.example .env    # then fill in your server URL, key and secret
```

Edit `models.json` so each entry matches an integration name in Developer Edition and a model added under it:

```json
[
  {"kind": "openai", "llmProvider": "openai", "model": "gpt-6.1-sol", "reasoningEffort": "low", "label": "GPT-6.1 Sol"},
  {"kind": "anthropic", "llmProvider": "anthropic", "model": "claude-sonnet-5", "label": "Claude Sonnet 5"},
  {"kind": "mistral", "transport": "mistral_conversations", "model": "mistral-large-2512", "label": "Mistral Large 3"}
]
```

- `kind` groups models by provider, so the fan-out never pairs a researcher with a reviewer of the same kind.
- `llmProvider` is the integration's name in Developer Edition, not the provider type.
- `transport: "mistral_conversations"` sends that model's calls through the Mistral route instead of the built-in LLM task.
- To use your own integration names without editing the tracked file, copy it to `models.local.json` (gitignored), which the server reads first.

As of October 30, 2026, Mistral's API rejects web search for `mistral-large-4` ("currently does not support builtin connectors"), so the default Mistral model is Mistral Large 3. `mistral-medium-latest` also supports web search.

Register the task definitions and workflows, then start the UI. If your Mistral secret has a different name, set `MISTRAL_SECRET_NAME` in `.env` first.

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
| `agent_turn` | One LLM call: builds the prompt, calls `LLM_CHAT_COMPLETE` (or Mistral's Conversations API through `HTTP`) and parses the JSON reply |

Each LLM call runs as its own small `agent_turn` workflow instead of sitting directly inside the `DO_WHILE`. Inside a loop, Conductor can add an LLM task's replies from earlier iterations to its next call's messages. We saw this on Developer Edition with GPT-6.1 Sol, and each turn here should only see the context it's given.

The source is split so it's easy to read and edit:

- `conductor/src/` holds the workflow definitions. A string like `"@include:prompts/reviewer.md"` pulls in another file.
- `conductor/prompts/` holds the planner, researcher, reviewer, section writer and editor prompts.
- `conductor/jq/` holds the `JSON_JQ_TRANSFORM` programs: the claim ledger, the stop rule and the report.
- `conductor/dist/` holds the generated definitions, with everything inlined. Rebuild them with `npm run build:defs` after you change anything in `conductor/`.
- `server/` holds the UI's API server and the PDF worker.
- `web/` holds the React app.

## Scaling and cost

The UI allows 1 to 30 research areas per run. A run makes about `2 + areas × (2 × rounds + 1)` LLM calls, and `2 × areas × rounds` of them use web search.

Provider rate limits are the first thing you hit with wide runs. In a 20-researcher test run, 3 of 138 model calls still hit Mistral's token or web search rate limits after three retries with backoff. Those turns count as failed, and the next round continues. Every model task retries with exponential backoff (see `conductor/taskdefs/`). One failed area doesn't fail the run, and the report lists it under "Areas that did not complete" with the reason.

## Notes

- **PDF:** on Orkes Developer Edition, Conductor's built-in `GENERATE_PDF` task saves the PDF on the Conductor server's local disk, where this app can't reach it. Saving it somewhere readable takes an S3 or Google Cloud Storage bucket and a matching cloud integration, so this project renders the PDF in a worker (`server/pdf.ts`) next to the UI instead.
- **Credentials:** your Conductor access key and secret stay in the server's `.env`. The browser only talks to the local server, which listens on 127.0.0.1.
- **Web content:** the PDF renderer runs with JavaScript off and no network access, because the report contains text from web pages.
