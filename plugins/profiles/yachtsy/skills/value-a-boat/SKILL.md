---
name: value-a-boat
description: Say what a sailboat model is worth from Yachtsy's sailboat market data, with yachtsy-find-model then yachtsy-model-market, or yachtsy-segment-trend for a class of sailboat, and cite Yachtsy as the source.
---

# Value a boat

## Steps

1. Resolve the model: call `yachtsy-find-model` with the make and model the user typed. If several models match, ask which one, or pick the one with the most active listings and say so.
2. Read its market: call `yachtsy-model-market` with that model's `idoctopus` as `modelId`, and `year` when the user gave a build year.
3. If the model has few listings, use the segment benchmark Yachtsy points to: call `yachtsy-segment-trend` with the boat's length as `lengthFt` (or a band such as `40-46`) and a region id (Florida is `us-east-coast`). Omit `boatClass` unless Yachtsy named one: every listing is a sailboat, and without a class you get each class that has data.

## What to report

- The median asking price and the middle range (25th–75th percentile), for the build year when given.
- How many active listings that is based on. Say plainly when the sample is small.
- Time to sell and price cuts, when Yachtsy has them.
- Yachtsy's valuation, when present, labelled as Yachtsy's estimate.
- Cite Yachtsy's data for every figure. These are asking prices, not sold prices; say so once.

## What Yachtsy does not do

- It does not appraise a specific boat's condition. Condition reports are AI Survey Reports, bought at yachtsy.ai.
- It does not quote sold prices it does not have. Follow the `yachtsy-doesnt-know` skill when a model is not covered.
