def arr: if type == "array" then . else [] end;
def link: "[source](" + . + ")";
. as $in
| ($in.ledger.claims // [] | arr) as $claims
| ($claims | map(select(.status == "supported"))) as $sup
| ($claims | map(select(.status == "disputed"))) as $dis
| ($in.ledger.refuted // [] | arr) as $ref
| ($in.progress // {}) as $p
| (if ($p.researchOkRounds // 0) == 0 then "failed"
   elif ($p.reviewOkRounds // 0) == 0 then "unreviewed"
   elif ($sup | length) + ($dis | length) == 0 then "no findings"
   elif $p.outcome == "verified" then "verified"
   elif $p.outcome == "degraded" then "degraded"
   else "partially verified" end) as $status
| ({"failed": "the researcher's model failed in every round",
    "unreviewed": "the reviewer's model failed, so no claim was checked",
    "no findings": "no claim survived review"}[$status] // null) as $reason
| ([ $sup[], $dis[] | .sources // [] | arr | .[] ] | unique) as $sources
| (if $in.sectionOk == true and ($in.section | type) == "string" and ($in.section | length) > 200 then $in.section
   else "### Key findings\n\n"
        + ([ $sup[] | "- " + .claim + " " + ([ .sources // [] | arr | .[] | link ] | join(" ")) ] | join("\n"))
        + (if ($dis | length) > 0
           then "\n\n### Contested or uncertain\n\n" + ([ $dis[] | "- " + .claim + " (reviewer: " + (.lastReason // "") + ")" ] | join("\n"))
           else "" end)
   end) as $body
| {areaIndex: $in.areaIndex, title: $in.title, researcher: $in.researcher, reviewer: $in.reviewer,
   rounds: ($p.round // 0), status: $status, reason: $reason,
   stats: {supported: ($sup | length), disputed: ($dis | length), refuted: ($ref | length),
           unverifiable: ($claims | map(select(.status == "unverifiable")) | length)},
   sectionMarkdown: $body,
   claims: [ $sup[], $dis[] | {id, claim, status, sources} ],
   refuted: $ref,
   gaps: ($in.feedback.gaps // [] | arr),
   sources: $sources,
   progress: ($p + {phase: "done", status: $status})}
