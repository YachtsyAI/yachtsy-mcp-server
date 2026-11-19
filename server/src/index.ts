#!/usr/bin/env node

import { composeHostedServer } from "./http/HostedServer.js";
import { HttpConfig } from "./http/HttpConfig.js";
import { PackageInfo } from "./PackageInfo.js";

/** In-flight asks can take minutes; a deploy gives them this long to finish. */
const DRAIN_MS = 25_000;

async function main(): Promise<void> {
  const packageInfo = await PackageInfo.load();
  const config = HttpConfig.fromEnv(process.env);
  const server = composeHostedServer(config, packageInfo).createNodeServer();
  server.listen(config.port, () => {
    console.log(
      `Yachtsy MCP ${packageInfo.version} listening on :${config.port} as ${config.publicBaseUrl}; OAuth ${config.oauthEnabled ? "on" : "off"}`,
    );
  });

  // Render sends SIGTERM on deploy: stop accepting, let in-flight calls end.
  let draining = false;
  const drain = (signal: string) => {
    if (draining) return;
    draining = true;
    console.log(`${signal}: draining for up to ${DRAIN_MS / 1000} s`);
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => process.exit(0), DRAIN_MS).unref();
  };
  process.on("SIGTERM", () => drain("SIGTERM"));
  process.on("SIGINT", () => drain("SIGINT"));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
