def num($d): if . == null then $d else (try tonumber catch $d) end;
def clamp($lo; $hi): if . < $lo then $lo elif . > $hi then $hi else . end;
def int: tostring | split(".") | .[0] | tonumber;
.in as $i
| ($i.maxIterations | num(3) | int | clamp(1; 6)) as $max
| ($i.models // [] | if type == "array" then . else [] end) as $m
| {topic: ($i.topic // "" | tostring | .[0:300]),
   goal: ($i.goal // $i.topic // "" | tostring | .[0:2000]),
   audience: ($i.audience // "a decision-maker who needs a sourced briefing" | tostring | .[0:200]),
   requestedAt: ($i.requestedAt // null),
   numAreas: ($i.numAreas | num(4) | int | clamp(1; 30)),
   minIterations: ($i.minIterations | num(2) | int | clamp(1; $max)),
   maxIterations: $max,
   models: $m,
   planner: ($i.planner // $m[0]),
   writer: ($i.writer // $m[1] // $m[0]),
   hasModels: (if ($m | length) > 0 then "yes" else "no" end)}
