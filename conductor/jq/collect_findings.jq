def arr: if type == "array" then . else [] end;
def n: if type == "number" then . else 0 end;
. as $root
| ([ ($root.joined // {}) | to_entries[] | .value | select(type == "object") | .report | select(type == "object") ]
   | sort_by(.areaIndex)) as $reports
| ($reports | map(select(.reason == null))) as $done
| ($done | map(.areaIndex)) as $ok
| [ ($root.planned // [] | arr)[] | . as $p | select(($ok | map(select(. == $p.areaIndex)) | length) == 0)
    | . + {reason: (($reports | map(select(.areaIndex == $p.areaIndex)) | .[0].reason) // "the research workflow failed")} ] as $missing
| {rounds: ([ $done[] | .rounds | n ] | add // 0),
   supported: ([ $done[] | .stats.supported | n ] | add // 0),
   disputed: ([ $done[] | .stats.disputed | n ] | add // 0),
   refuted: ([ $done[] | .stats.refuted | n ] | add // 0)} as $t
| {areas: $done, missing: $missing, completedCount: ($done | length),
   hasResults: (if ($done | length) > 0 then "yes" else "no" end),
   totals: ($t + {areas: ($done | length), planned: ($root.planned // [] | arr | length)}),
   missingText: (if ($missing | length) == 0 then "none" else ($missing | map(.title + " (" + .reason + ")") | join("; ")) end),
   totalsText: (($done | length | tostring) + " of " + ($root.planned // [] | arr | length | tostring) + " areas completed, "
                + ($t.rounds | tostring) + " review rounds, " + ($t.supported | tostring) + " supported claims, "
                + ($t.disputed | tostring) + " disputed and " + ($t.refuted | tostring) + " refuted"),
   digest: ($done | map({title, researcher: .researcher.label, reviewer: .reviewer.label, status, stats,
                         section: (.sectionMarkdown // "" | .[0:6000])}) | tojson)}
