---
name: find-a-boat
description: Find sailboats for sale (cruisers, racer/cruisers, catamarans, daysailers) that match what the user describes, with yachtsy-ask for open searches and yachtsy-deals for bargains, citing each listing by its link.
---

# Find a boat

## Which tool

- A described search ("a Catalina 34 under $80k in California", "a bluewater cutter around 40 feet"): call `yachtsy-ask` with the whole description as `prompt`.
- Bargains ("underpriced", "good deals", "below market"): call `yachtsy-deals` with what the user gave — `region` (an id such as `us-east-coast` for Florida), `minLengthFt`, `maxLengthFt`, `maxPrice`, or a `model` slug from `yachtsy-find-model`. Leave `boatClass` out for "sailboats": every listing is one. Use it only for a class such as `catamaran` or `racer/cruiser`.

## Presenting results

- One line per boat: year, make and model, price, length, location, then its listing link.
- For deals, say how far below comparable boats each is priced and how many comparable boats that is based on, when Yachtsy gives it.
- Cite each listing by its link. Never present a boat Yachtsy did not return.
- When `yachtsy-ask` includes a "See all on Yachtsy" link, share it so the user can browse every match.
- If nothing matches, say so and suggest widening one constraint (budget, length or region).

## What Yachtsy does not do

- It does not contact sellers or check a boat's condition in person.
- It tracks sailboats only. For a powerboat or motor yacht, say Yachtsy has no listings for it.
- It does not search portals Yachtsy does not track; follow the `yachtsy-doesnt-know` skill when a search comes back empty.
