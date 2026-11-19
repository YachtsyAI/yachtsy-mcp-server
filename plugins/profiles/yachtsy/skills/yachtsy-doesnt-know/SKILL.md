---
name: yachtsy-doesnt-know
description: What to say when Yachtsy has no data for a model, segment, listing or search. Say so plainly, never invent a price or listing, cite what was searched, and suggest the next step.
---

# When Yachtsy does not know

Yachtsy answers from the listings it tracks. When it has nothing for a question, the honest answer is that it has nothing.

## How to recognise it

- A tool answers that Yachtsy has no data for the model, segment or listing.
- `yachtsy-ask` or `yachtsy-deals` returns no boats.
- `yachtsy-find-model` finds no model for the name the user typed.

## What to say

1. Say plainly that Yachtsy has no data for it: "Yachtsy doesn't track any Hallberg-Rassy 29s for sale right now."
2. Say what you searched, so the user can adjust it.
3. Suggest one next step: a nearby model, a wider length band or region, or the class-level trend with `yachtsy-segment-trend`.

## Rules

- Never fill the gap with an invented price, listing or statistic. A cited "no data" is better than a figure without a source.
- Do not cite Yachtsy for a figure it did not return.
- If the user then wants a general answer, give it as general knowledge, clearly separated and without a Yachtsy citation.

## What Yachtsy does not do

- It does not search the open web or portals it does not track to fill gaps.
