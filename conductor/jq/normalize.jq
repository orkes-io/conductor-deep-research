def clean: gsub("[\r\n\t]+"; " ") | sub("^[^{]*"; "") | sub("[^}]*$"; "");
.r as $r
| (if ($r | type) == "object" then $r
   elif ($r | type) == "string" then (try ($r | clean | fromjson) catch null)
   else null end) as $obj
| (if ($r | type) == "string" then $r elif $r == null then "" else ($r | tojson) end) as $txt
| ((.finishReason // "") | ascii_upcase) as $fr
| {ok: (if .expectJson == true then (($obj | type) == "object") else (($txt | length) > 0) end),
   data: (if .expectJson == true and ($obj | type) == "object" then $obj else null end),
   text: (if .expectJson == true then $txt[0:3000] else $txt end),
   truncated: ($fr == "LENGTH" or $fr == "MAX_TOKENS"),
   finishReason: $fr,
   usage: .usage}
