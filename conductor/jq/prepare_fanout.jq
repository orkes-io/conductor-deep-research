def arr: if type == "array" then . else [] end;
. as $root | $root.cfg as $c | ($c.models | arr) as $m | ($m | length) as $n
| (if ($root.plan | type) == "object" then ($root.plan.areas // $root.plan.researchAreas // [] | arr) else [] end) as $raw
| ([ $raw[] | select(type == "object") | select(((.title // "") | length) > 0) ] | .[0:$c.numAreas]) as $areas
| ($areas | map(.title)) as $titles
| (if $n == 0 then [] else
   [ $areas | to_entries[] | .key as $i | .value as $a | $m[$i % $n] as $res
     | ([ range(1; $n) as $k | $m[($i + $k) % $n] | select(.kind != $res.kind) ] | .[0] // $m[($i + 1) % $n]) as $rev
     | {runId: $root.runId, topic: $c.topic, goal: $c.goal, audience: $c.audience, areaIndex: $i,
        area: {title: $a.title, focus: ($a.focus // ""), questions: ($a.questions // [] | arr | map(tostring) | .[0:5])},
        otherAreasText: ($titles | map(select(. != $a.title)) | join("; ")),
        researcher: $res, reviewer: $rev,
        minIterations: $c.minIterations, maxIterations: $c.maxIterations} ]
   end) as $inputs
| {forkInputs: $inputs, count: ($inputs | length),
   hasAreas: (if ($inputs | length) > 0 then "yes" else "no" end),
   plan: ($inputs | map({areaIndex, title: .area.title, researcher: .researcher.label, reviewer: .reviewer.label}))}
