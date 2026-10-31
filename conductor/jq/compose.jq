(.user + (if .context == null then "" else "\n\nCONTEXT (JSON):\n" + (.context | tojson) end)) as $text
| {text: $text,
   mistralBody: {model: .model, store: false, instructions: .system, inputs: $text,
                 tools: (if .webSearch == true then [{type: "web_search"}] else [] end),
                 completion_args: ({max_tokens: .maxTokens} + (if .reasoningEffort then {reasoning_effort: .reasoningEffort} else {} end))}}
