def arr: if type == "array" then . else [] end;
def s: if . == null then "" else tostring end;
. as $in | $in.cfg as $c | $in.collected as $col
| ($col.areas // [] | arr) as $areas
| ([ $areas[] | .sources // [] | arr | .[] ] | unique) as $sources
| (if ($in.synthesis | type) == "string" and ($in.synthesis | length) > 200 then $in.synthesis
   else "_The editor step didn't complete, so this report has no executive summary. The research sections below are complete._" end) as $syn
| ([ $areas[]
     | "## " + ((.areaIndex + 1) | tostring) + ". " + .title + "\n\n"
       + "_Researcher: " + (.researcher.label | s) + ". Reviewer: " + (.reviewer.label | s) + ". Rounds: "
       + (.rounds | s) + ". Status: " + (.status | s) + " (" + (.stats.supported | s) + " supported, "
       + (.stats.disputed | s) + " disputed, " + (.stats.refuted | s) + " refuted)._\n\n"
       + (.sectionMarkdown | s) ] | join("\n\n")) as $sections
| ("| # | Area | Researcher | Reviewer | Rounds | Supported | Disputed | Refuted | Status |\n"
   + "|---|---|---|---|---|---|---|---|---|\n"
   + ([ $areas[] | "| " + ((.areaIndex + 1) | tostring) + " | " + (.title | s | gsub("\\|"; "/")) + " | "
          + (.researcher.label | s) + " | " + (.reviewer.label | s) + " | " + (.rounds | s) + " | "
          + (.stats.supported | s) + " | " + (.stats.disputed | s) + " | " + (.stats.refuted | s) + " | "
          + (.status | s) + " |" ] | join("\n"))) as $table
| ("# " + $c.topic + "\n\n"
   + "**Goal:** " + $c.goal + "\n\n"
   + "**Audience:** " + $c.audience + "\n\n"
   + "_Run " + ($in.runId | s) + (if $c.requestedAt then ", started " + ($c.requestedAt | s) else "" end)
   + ". " + ($col.totalsText | s) + "._\n\n"
   + $syn + "\n\n"
   + "# Findings by research area\n\n" + $sections + "\n\n"
   + "# Methodology\n\n"
   + "One model researched each area with live web search, and a model from a different provider tried to refute every claim. Refuted claims were revised or withdrawn in the next round.\n\n"
   + $table + "\n\n"
   + "Areas that did not complete: " + ($col.missingText | s) + ".\n\n"
   + "# Sources\n\n"
   + ([ range(0; $sources | length) as $k | (($k + 1) | tostring) + ". <" + $sources[$k] + ">" ] | join("\n"))) as $md
| {markdown: $md, sourceCount: ($sources | length)}
