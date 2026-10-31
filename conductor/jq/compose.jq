{text: (.user + (if .context == null then "" else "\n\nCONTEXT (JSON):\n" + (.context | tojson) end))}
