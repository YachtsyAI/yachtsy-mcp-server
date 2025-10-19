import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import OpenAI from "openai";
import { z } from "zod";

// Configuration schema - users provide their Yachtsy API key
export const configSchema = z.object({
  yachtsyApiKey: z.string().describe("Your Yachtsy API key (get one at https://www.yachtsy.ai/signup)"),
  yachtsyApiBaseUrl: z.string().default("https://api.yachtsy.ai/v1").describe("Yachtsy API base URL (optional)"),
});

// Helper function to process streaming responses
async function processStreamingResponse(stream: any): Promise<string> {
  let fullResponse = "";
  let citations: any[] = [];

  try {
    // Process the streaming response
    for await (const chunk of stream) {
      // For Chat Completions API
      if (chunk.choices && chunk.choices[0]?.delta?.content) {
        fullResponse += chunk.choices[0].delta.content;

        // Check for citations in the final chunk
        if (chunk.choices[0]?.finish_reason === "stop" && chunk.choices[0]?.citations) {
          citations = chunk.choices[0].citations;
        }
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

type PromptParams = {
  prompt: string;
};

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
  server.tool(
    "yachtsy-agent",
    "[YACHT MARKETPLACE INTELLIGENCE] Main Yachtsy agent with automatic routing to specialized sub-agents. Capabilities: Intelligently routes queries to Listings Agent, General Boat Expert (Small Talk Agent), or Deep Research Agent based on context. Handles boat listings searches, yacht specifications, market trends, sailing advice, and general yacht-related questions. Best for: Any yacht or boat-related query - the agent will automatically select the best specialized agent. Example queries: 'Show me Catalina 34 sailboats under $100k', 'What are the best bluewater cruising boats?', 'Find me yacht listings in Florida', 'Tell me about the Tayana 37', 'What should I look for when buying a used sailboat?'.",
    {
      prompt: z.string().describe("Your natural language query about yachts, boats, or sailing"),
    },
    async ({ prompt }: PromptParams) => {
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

  // Return the server instance (Smithery will wrap it with HTTP transport)
  return server.server;
}
