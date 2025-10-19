#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { readFile } from "fs/promises";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

// Get package.json info
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJsonContent = await readFile(packageJsonPath, "utf8");
const packageInfo = JSON.parse(packageJsonContent) as { name: string; version: string };

// Load environment variables
dotenv.config();

// Check for required environment variables
const YACHTSY_API_KEY = process.env.YACHTSY_API_KEY;
const YACHTSY_API_BASE_URL = process.env.YACHTSY_API_BASE_URL || "https://api.yachtsy.ai/v1";

if (!YACHTSY_API_KEY) {
  console.error("Error: YACHTSY_API_KEY is not set in the environment variables");
  console.error("Please set the YACHTSY_API_KEY environment variable or use 'env YACHTSY_API_KEY=your_key npx -y yachtsy-mcp'");
  process.exit(1);
}

// Initialize OpenAI client with Yachtsy API
const yachtsyClient = new OpenAI({
  apiKey: YACHTSY_API_KEY,
  baseURL: YACHTSY_API_BASE_URL,
  defaultHeaders: {
    "User-Agent": `${packageInfo.name}/${packageInfo.version} (Node.js/${process.versions.node})`
  },
});

// Create MCP server
const server = new McpServer({
  name: packageInfo.name,
  version: packageInfo.version,
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

// Define a schema for the 'prompt' parameter that all tools will use
const promptSchema = z.object({
  prompt: z.string().describe("Your natural language query or request for the agent"),
});

type PromptParams = {
  prompt: string;
};

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

// Start the server with stdio transport
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    process.exit(1);
  }
}

main(); 
