import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type LogLevel = "debug" | "info" | "notice" | "warning" | "error";

/**
 * Structured logs for one tool call, sent to the MCP client and to stdout.
 *
 * Callers log identifiers, counts and statuses only. Prompts, file bytes and
 * API keys never reach a log line.
 */
export class ToolLogger {
  constructor(
    private readonly server: McpServer | null,
    private readonly principal: string,
  ) {}

  async event(
    level: LogLevel,
    message: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    const entry = { message, principal: this.principal, ...data };
    if (level === "error") console.error(JSON.stringify({ level, ...entry }));
    try {
      await this.server?.server.sendLoggingMessage({
        level,
        logger: "yachtsy",
        data: entry,
      });
    } catch {
      // Logging is best-effort and must never break a tool call.
    }
  }
}
