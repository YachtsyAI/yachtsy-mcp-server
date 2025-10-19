#!/bin/bash

# Yachtsy MCP Server Installation Script

echo "Installing Yachtsy MCP Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js before continuing."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "npm is not installed. Please install npm before continuing."
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the server
echo "Building the server..."
npm run build

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "Please edit the .env file and add your Yachtsy API key."
fi

echo "Installation complete!"
echo ""
echo "There are multiple ways to use the Yachtsy MCP Server:"
echo ""
echo "1. Run directly with your API key:"
echo "   env YACHTSY_API_KEY=your_yachtsy_api_key node ./dist/index.js"
echo ""
echo "2. Install globally and run with npx:"
echo "   npm install -g ."
echo "   env YACHTSY_API_KEY=your_yachtsy_api_key npx yachtsy-mcp"
echo ""
echo "3. To use with Claude Desktop, add the following to your claude_desktop_config.json:"
echo '{
  "mcpServers": {
    "yachtsy": {
      "command": "env",
      "args": ["YACHTSY_API_KEY=your_yachtsy_api_key", "npx", "-y", "yachtsy-mcp"]
    }
  }
}'
echo ""
echo "4. To use with Cursor, add a new MCP server with:"
echo "   - Name: yachtsy-mcp"
echo "   - Type: command"
echo "   - Command: env YACHTSY_API_KEY=your_yachtsy_api_key npx -y yachtsy-mcp" 