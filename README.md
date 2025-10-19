# Yachtsy: MCP for Yacht Marketplace Intelligence

![Yachtsy AI](https://www.yachtsy.ai/)

The Yachtsy MCP server provides AI-powered yacht and boat marketplace intelligence by integrating with the Yachtsy Agent API. Access 25,000+ boat listings, get expert sailing advice, and find your perfect vessel within Claude Desktop, Cursor, and other popular MCP clients.

## Features

✅ **Intelligent Agent Routing** - Automatically routes your queries to the best specialized agent:
   - **Listings Agent** - Search 25,000+ boat listings with advanced filtering
   - **General Boat Expert (Small Talk Agent)** - General sailing and boating questions
   - **Deep Research Agent** - Comprehensive yacht market analysis

✅ **Comprehensive Boat Listings** - Search and filter by:
   - Make, model, and class
   - Price range and currency
   - Location (city, country, region)
   - Year, length, and specifications
   - Broker and dealer information

✅ **Expert Sailing Knowledge** - Get advice on:
   - Boat selection and recommendations
   - Bluewater cruising preparation
   - Sailing techniques and best practices
   - Yacht maintenance and systems

## Get Your Yachtsy API Key

To use Yachtsy MCP, you need to:

1. Sign up for a free account at [Yachtsy.ai](https://www.yachtsy.ai/signup)
2. Navigate to **API Keys** in your dashboard
3. Generate a new API key
4. Use this API key in your configuration as the `YACHTSY_API_KEY` value

## Prerequisites

Before installing or running Yachtsy MCP, you need to have `npx` (which comes with Node.js and npm) installed on your system.

### Mac (macOS)

1. **Install Homebrew** (if you don't have it):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. **Install Node.js (includes npm and npx):**
   ```bash
   brew install node
   ```

3. **Verify installation:**
   ```bash
   node -v
   npm -v
   npx -v
   ```

### Windows

1. **Download the Node.js installer:**
   - Go to [https://nodejs.org/](https://nodejs.org/) and download the LTS version for Windows.
2. **Run the installer** and follow the prompts. This will install Node.js, npm, and npx.
3. **Verify installation:**
   Open Command Prompt and run:
   ```cmd
   node -v
   npm -v
   npx -v
   ```

## Installation

### Running on Claude Desktop

To configure Yachtsy MCP for Claude Desktop:

1. Open Claude Desktop
2. Go to Settings > Developer > Edit Config
3. Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "yachtsy-mcp-server": {
      "command": "npx",
      "args": ["-y", "yachtsy-mcp@latest"],
      "env": {
        "YACHTSY_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

4. Restart Claude for the changes to take effect

### Running on Cursor

**Note:** Requires Cursor version 0.45.6+

To configure Yachtsy MCP in Cursor:

1. Open Cursor Settings
2. Go to Features > MCP Servers 
3. Click "+ Add New MCP Server"
4. Enter the following:
   - Name: "yachtsy-mcp" (or your preferred name)
   - Type: "command"
   - Command: `env YACHTSY_API_KEY=your-yachtsy-api-key npx -y yachtsy-mcp`

> If you are using Windows and are running into issues, try `cmd /c "set YACHTSY_API_KEY=your-yachtsy-api-key && npx -y yachtsy-mcp"`

Replace `your-yachtsy-api-key` with your Yachtsy API key.

After adding, refresh the MCP server list to see the new tools. The Composer Agent will automatically use Yachtsy MCP when appropriate for yacht-related queries.

### Running on Windsurf

Add this to your `./codeium/windsurf/model_config.json`:

```json
{
  "mcpServers": {
    "yachtsy-mcp-server": {
      "command": "npx",
      "args": ["-y", "yachtsy-mcp@latest"],
      "env": {
        "YACHTSY_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

### Running with npx

```bash
env YACHTSY_API_KEY=your_yachtsy_api_key npx -y yachtsy-mcp
```

### Manual Installation

```bash
npm install -g yachtsy-mcp
```

## Available Tools

### yachtsy-agent

**[YACHT MARKETPLACE INTELLIGENCE]** Main Yachtsy agent with automatic routing to specialized sub-agents.

**Capabilities:**
- Search 25,000+ boat and yacht listings
- Filter by make, model, price, location, year, length, and more
- Get detailed yacht specifications and broker information
- Receive expert sailing and cruising advice
- Research yacht market trends and values
- Get boat buying and selling recommendations

**Best for:** Any yacht or boat-related query - the agent will automatically select the best specialized sub-agent for your needs.

**Example queries:**
```
Show me Catalina 34 sailboats under $100k
Find Tayana 37 listings in good condition
What are the best bluewater cruising boats between 40-50 feet?
Find me yacht listings in the Caribbean under $200k
Tell me about the Hallberg-Rassy 42
What should I look for when buying a used cruising sailboat?
Compare the Island Packet 380 vs Pacific Seacraft 40
Show me center cockpit sailboats suitable for ocean crossing
What are the maintenance costs for a 40-foot sailboat?
Find me aluminum hulled sailboats for world cruising
```

## Example Use Cases

### Boat Shopping
```
"Show me Catalina 34 sailboats under $80,000 in California"
"Find bluewater cruising boats between 38-45 feet suitable for a couple"
"What Hallberg-Rassy boats are available in Europe?"
```

### Yacht Research
```
"Tell me about the Tayana 37 and its reputation for offshore cruising"
"Compare the Island Packet 380 vs the Passport 40 for liveaboard cruising"
"What are the common issues with the Beneteau Oceanis 46?"
```

### Sailing Advice
```
"What should I look for when buying a used bluewater cruising sailboat?"
"Recommend a good first sailboat for a family of four under $50k"
"What are the best boats for single-handed sailing?"
```

### Market Intelligence
```
"What's the typical price range for a 1985 Tayana 37 in good condition?"
"Show me market trends for 40-foot cruising catamarans"
"Find me the most popular boats for sale under $100k"
```

## Documentation

For comprehensive documentation on Yachtsy AI agents, please visit:
[https://www.yachtsy.ai](https://www.yachtsy.ai)

## Troubleshooting

1. **API Key Issues**: Ensure your Yachtsy API key is correctly set in the environment or config file.
2. **Connection Issues**: Verify that `https://api.yachtsy.ai` is accessible from your network.
3. **Rate Limiting**: If you encounter rate limiting, reduce the frequency of your requests.

## Environment Variables

```bash
YACHTSY_API_KEY=your-api-key-here              # Required
YACHTSY_API_BASE_URL=https://api.yachtsy.ai/v1  # Optional, defaults to production
```

## License

MIT

## About Yachtsy

Yachtsy AI is the intelligent yacht marketplace assistant that helps sailors and yacht enthusiasts find their perfect vessel. With access to over 25,000 listings and expert sailing knowledge, Yachtsy makes boat shopping and sailing research effortless.

Visit [www.yachtsy.ai](https://www.yachtsy.ai) to learn more.

---

⭐ Star this repo if you find it helpful!
