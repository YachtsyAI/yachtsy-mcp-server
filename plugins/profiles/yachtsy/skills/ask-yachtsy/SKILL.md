---
name: ask-yachtsy
description: Answer a boat or sailing question with yachtsy-ask, citing every listing by its link. Use for boats for sale, specs, buying advice and any open question about yachts and sailboats.
---

# Ask Yachtsy

Use `yachtsy-ask` for open questions about boats and sailing: boats for sale that match a description, what to look for in a model, whether a design suits bluewater cruising, buying advice, tides.

## How to call it

- `prompt` (required): the user's question in full, with every constraint they gave (budget, length, region, year range, "as a table").
- `agent` (optional): leave it empty. The default agent routes the question to the right specialist.

Each call stands alone: Yachtsy does not remember earlier questions. For a follow-up ("and which of those is cheapest?"), write the full question into `prompt`, naming the boats it is about.

## Cite every listing

- Keep every listing link Yachtsy returns, next to the boat it belongs to.
- Attribute prices and statistics to Yachtsy ("according to Yachtsy's listings data").
- If the answer says something needs a report credit or an account, relay that message and its link as it is.
- A big search shows only the highest-priced matches. When the answer includes a "See all on Yachtsy" link, share it: it opens every match in a sortable table with a map.
- Do not add listings, prices or specs from general knowledge. If you add context of your own, label it clearly as not coming from Yachtsy.

## Example

User: "Find Catalina 34s under $80k in California."

1. Call `yachtsy-ask` with that request.
2. Reply with each boat's year, price and location, and cite its listing link.

## What Yachtsy does not do

- It does not contact sellers, make offers or book viewings.
- It does not answer about cars, property or anything that is not a boat.
- For one model's value use `yachtsy-model-market`; for bargains use `yachtsy-deals`.
