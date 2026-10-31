def arr: if type == "array" then . else [] end;
def clip($n): if type == "string" then (if length > $n then .[0:$n] + "..." else . end) else "" end;
def urls($k): [ (. // [] | arr)[] | select(type == "string") | select(test("^https?://")) ] | unique | .[0:$k];
def verdict: if . == "supported" or . == "disputed" or . == "refuted" or . == "unverifiable" then . else "unverifiable" end;
. as $in
| ($in.round | tonumber) as $round
| ($in.minIterations | tonumber) as $min
| ($in.maxIterations | tonumber) as $max
| ($in.review.ok == true) as $rok
| (if $rok and (($in.review.data | type) == "object") then $in.review.data else {} end) as $R
| ($R.verdicts // [] | arr | map(select(type == "object")) | map(select((.id | type) == "string"))
   | map({key: .id, value: .}) | from_entries) as $V
| [ ($in.ledger.claims // [] | arr)[] | . as $c | $V[$c.id] as $v
    | if $v == null then $c
      else $c + {status: ($v.verdict | verdict), lastReason: ($v.reason | clip(300)),
                 counterSources: ($v.counterSources | urls(3)), reviewedRound: $round}
      end ] as $all
| ($all | map(select(.status == "refuted"))) as $newRef
| ($all | map(select(.status != "refuted"))) as $claims
| (($in.ledger.refuted // [] | arr) + ($newRef | map({id, claim: (.claim | clip(200)), reason: .lastReason, round: $round}))
   | .[-20:]) as $refuted
| ($claims | map(select(.status == "supported")) | length) as $s
| ($claims | map(select(.status == "disputed")) | length) as $d
| ($claims | map(select(.status == "unverifiable")) | length) as $u
| ($claims | map(select(.status == "pending")) | length) as $p
| (($in.prev.failedTurns // 0) + (if $in.researchOk == true then 0 else 1 end) + (if $rok then 0 else 1 end)) as $fails
| ($R.sufficient == true) as $suff
| ($round >= $min and $rok and $suff and $s >= 4 and ($d + $p) <= 3) as $gate
| ($fails >= 3) as $abort
| {ledger: {claims: $claims, refuted: $refuted, nextId: ($in.ledger.nextId // 1)},
   feedback: {gaps: ($R.gaps // [] | arr | map(clip(200)) | .[0:6]),
              nextQueries: ($R.nextQueries // [] | arr | map(clip(160)) | .[0:6]),
              challenges: ([ $claims[] | select(.status == "disputed" or .status == "unverifiable")
                             | {id, claim: (.claim | clip(200)), reviewer: .lastReason} ] | .[0:10]),
              refutedThisRound: [ $newRef[] | {id, claim: (.claim | clip(200)), reviewer: .lastReason} ],
              critique: ($R.critique // "" | clip(600))},
   progress: {round: $round, maxRounds: $max, supported: $s, disputed: $d, refuted: ($refuted | length),
              unverifiable: $u, pending: $p, coverage: ($R.coverage // null), sufficient: $suff,
              failedTurns: $fails, done: ($gate or $abort),
              researchOkRounds: (($in.prev.researchOkRounds // 0) + (if $in.researchOk == true then 1 else 0 end)),
              reviewOkRounds: (($in.prev.reviewOkRounds // 0) + (if $rok then 1 else 0 end)),
              outcome: (if $gate then "verified" elif $abort then "degraded" else "in_progress" end),
              phase: (if ($gate or $abort or $round >= $max) then "writing" else "researching" end),
              researcher: $in.prev.researcher, reviewer: $in.prev.reviewer}}
