import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  try {
    // Create a client
    const client = new Client({
      name: "yachtsy-client-example",
      version: "1.0.0",
    });

    // Connect to the server
    const transport = new StdioClientTransport({
      command: "node",
      args: ["../dist/index.js"],
      env: {
        // Ensure the server receives your Yachtsy API key
        YACHTSY_API_KEY: process.env.YACHTSY_API_KEY || "YOUR_API_KEY_HERE",
      },
    });
    await client.connect(transport);

    console.log("Connected to Yachtsy MCP server");

    // List available tools
    const toolsResult = await client.listTools();
    console.log("Available tools:");
    for (const tool of toolsResult.tools) {
      console.log(`- ${tool.name}: ${tool.description}`);
    }

    // Validated prompt 1
    console.log("\nTell me more about Tayana 37...");
    const p1 = await client.callTool({
      name: "yachtsy-agent",
      arguments: { prompt: "Tell me more about Tayana 37" },
    });
    console.log((p1 as any).content[0].text);

    // Validated prompt 2
    console.log("\nShow me Tayana 37 listings for sale...");
    const p2 = await client.callTool({
      name: "yachtsy-agent",
      arguments: { prompt: "Show me Tayana 37 listings for sale" },
    });
    console.log((p2 as any).content[0].text);

    // Validated prompt 3
    console.log("\nFind 30-40ft sailboats under $50k in Charleston, SC...");
    const p3 = await client.callTool({
      name: "yachtsy-agent",
      arguments: { prompt: "Find 30-40ft sailboats under $50k in Charleston, SC" },
    });
    console.log((p3 as any).content[0].text);

    // Validated prompt 4
    console.log("\nTide chart for Charleston today...");
    const p4 = await client.callTool({
      name: "yachtsy-agent",
      arguments: { prompt: "Tide chart for Charleston today" },
    });
    console.log((p4 as any).content[0].text);

    // Close the client
    await client.close();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main(); 