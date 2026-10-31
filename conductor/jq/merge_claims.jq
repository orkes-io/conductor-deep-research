def arr: if type == "array" then . else [] end;
def clip($n): if type == "string" then (if length > $n then .[0:$n] + "..." else . end) else "" end;
def urls($k): [ (. // [] | arr)[] | select(type == "string") | select(test("^https?://")) ] | unique | .[0:$k];
. as $in
| ($in.round | tonumber) as $round
| ($in.ledger // {claims: [], refuted: [], nextId: 1}) as $L
| ($in.turn.ok == true) as $ok
| (if $ok then ($in.turn.data.claims // [] | arr) else [] end | map(select(type == "object"))) as $items
| ($items | map(select(.action == "retract") | .id)) as $retract
| ($items | map(select(.action == "revise" and .id != null))) as $revise
| ($items | map(select((.action // "add") == "add")
                | select(((.claim // "") | length) > 10)
                | select((.sources | urls(4) | length) > 0))) as $adds
| [ ($L.claims // [] | arr)[] | . as $c
    | select(($retract | map(select(. == $c.id)) | length) == 0)
    | ($revise | map(select(.id == $c.id))) as $rs
    | if ($rs | length) == 0 then $c
      else $rs[0] as $r
      | ($r.sources | urls(4)) as $u
      | $c + {claim: ($r.claim // $c.claim | clip(400)),
              evidence: ($r.evidence // $c.evidence | clip(300)),
              sources: (if ($u | length) > 0 then $u else $c.sources end),
              confidence: ($r.confidence // $c.confidence),
              status: "pending", round: $round, revisions: (($c.revisions // 0) + 1)}
      end ] as $kept
| [ range(0; $adds | length) as $k | $adds[$k]
    | {id: ("C" + (($L.nextId + $k) | tostring)),
       claim: (.claim | clip(400)),
       evidence: (.evidence | clip(300)),
       sources: (.sources | urls(4)),
       confidence: (.confidence // "medium"),
       status: "pending", round: $round, revisions: 0,
       lastReason: "", counterSources: []} ] as $added
| (($kept + $added) as $all
   | ($all | map(select(.status == "supported"))) + ($all | map(select(.status != "supported")))
   | .[0:24]) as $claims
| {ledger: {claims: $claims, refuted: ($L.refuted // [] | arr), nextId: ($L.nextId + ($adds | length))},
   reviewSet: [ $claims[] | select(.status != "supported")
                | {id, claim, evidence, sources, previousVerdict: .status, previousReason: .lastReason} ],
   supportedBrief: [ $claims[] | select(.status == "supported") | {id, claim: (.claim | clip(160))} ],
   researchOk: $ok,
   researcherSummary: (if $ok then (($in.turn.data.summary // "") | clip(600)) else "The researcher turn failed this round." end),
   stats: {added: ($added | length), revised: ($revise | length), retracted: ($retract | length)}}
