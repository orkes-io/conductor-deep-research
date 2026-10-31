def arr: if type == "array" then . else [] end;
(.body.outputs // [] | arr) as $o
| [ $o[] | select(.type == "message.output") | .content ] as $contents
| {text: ([ $contents[] | if type == "string" then . else ([ arr[] | select(.type == "text") | .text // "" ] | join("")) end ] | join("")),
   refs: ([ $contents[] | arr[] | select(.type == "tool_reference") | .url | select(type == "string") ] | unique),
   searches: ([ $o[] | select(.type == "tool.execution") ] | length),
   finishReason: (if ($contents | length) > 0 then "STOP" else "ERROR" end),
   usage: {promptTokens: .body.usage.prompt_tokens, completionTokens: .body.usage.completion_tokens,
           totalTokens: .body.usage.total_tokens, searchTokens: .body.usage.connector_tokens}}
