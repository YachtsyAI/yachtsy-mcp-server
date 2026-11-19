---
name: check-a-listing
description: Tell the user whether a boat listing they share is well priced, with yachtsy-check-listing, citing the listing link and Yachtsy's comparable-boat benchmark.
---

# Check a listing

Use `yachtsy-check-listing` when the user shares a link to a boat for sale and asks whether it is a good price, how long it has been listed, or whether the price has dropped.

## How to call it

- `url` (required): the listing link exactly as the user gave it. It must start with `https://`.
- Yachtsy looks the link up in the listings it tracks. It does not open the page.

## What to report

- The asking price and where it sits against comparable boats (the benchmark and how many boats it is based on).
- Days on the market and any price cuts.
- Whether Yachtsy flags the listing as stale.
- Cite the listing link and attribute the benchmark to Yachtsy.

If Yachtsy does not track the link, say so plainly and offer to value the model instead with `yachtsy-find-model` and `yachtsy-model-market`.

## What Yachtsy does not do

- It does not contact the seller or negotiate.
- It does not judge the boat's condition from the listing photos.
