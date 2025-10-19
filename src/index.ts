import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import OpenAI from "openai";
import { z } from "zod";

// Configuration schema - users provide their Yachtsy API key
export const configSchema = z.object({
  yachtsyApiKey: z.string().describe("Your Yachtsy API key (get one at https://www.yachtsy.ai/signup)"),
  yachtsyApiBaseUrl: z.string().default("https://api.yachtsy.ai/v1").describe("Yachtsy API base URL"),
});

// Helper function to process streaming responses
async function processStreamingResponse(stream: any): Promise<string> {
  let fullResponse = "";

  try {
    // Process the streaming response
    for await (const chunk of stream) {
      // For Chat Completions API
      if (chunk.choices && chunk.choices[0]?.delta?.content) {
        fullResponse += chunk.choices[0].delta.content;
      }

      // For Responses API
      if (chunk.type === "response.output_text.delta") {
        fullResponse += chunk.text?.delta || "";
      }
    }

    return fullResponse;
  } catch (error) {
    console.error("Error processing streaming response:", error);
    throw error;
  }
}

// Main server factory function
export default function createServer({ config }: { config: z.infer<typeof configSchema> }) {
  // Initialize OpenAI client with Yachtsy API
  const yachtsyClient = new OpenAI({
    apiKey: config.yachtsyApiKey,
    baseURL: config.yachtsyApiBaseUrl,
    defaultHeaders: {
      "User-Agent": "yachtsy-mcp/1.0.0 (Smithery)"
    },
  });

  // Create MCP server
  const server = new McpServer({
    name: "yachtsy-mcp",
    version: "1.0.0",
  });

  // Yachtsy Main Agent - Auto-routing to specialized agents
  server.registerTool(
    "yachtsy-agent",
    {
      title: "Yachtsy Agent",
      description: "Main Yachtsy agent with automatic routing to specialized sub-agents. Intelligently routes queries to Listings Agent, General Boat Expert, or Deep Research Agent. Handles boat listings searches, yacht specifications, market trends, sailing advice, and general yacht-related questions. Example queries: 'Show me Catalina 34 sailboats under $100k', 'What are the best bluewater cruising boats?', 'Find me yacht listings in Florida'",
      inputSchema: {
        prompt: z.string().describe("Your natural language query about yachts, boats, or sailing"),
      },
    },
    async ({ prompt }: { prompt: string }) => {
      try {
        const response = await yachtsyClient.chat.completions.create({
          model: "yachtsy-agent",
          messages: [{ role: "user", content: prompt }],
          stream: true,
        });

        const result = await processStreamingResponse(response);
        return {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
        };
      } catch (error) {
        console.error("Error calling Yachtsy agent:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Failed to process yacht marketplace query. ${error}`,
            },
          ],
        };
      }
    }
  );

  // Return the server instance (not server.server)
  return server;
}
