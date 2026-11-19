/**
 * Replaces global fetch with a recorder that answers through `respond`.
 * Every test reaches the real client classes; only the network is fake.
 */

const realFetch = globalThis.fetch;

export function stubFetch(respond) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const call = {
      url: new URL(String(url)),
      init,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    return respond(call);
  };
  return calls;
}

export function restoreFetch() {
  globalThis.fetch = realFetch;
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
