#!/usr/bin/env python3
import asyncio
import os
from typing import Optional
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    # Create server parameters for stdio connection
    server_params = StdioServerParameters(
        command="node",
        args=["../dist/index.js"],
        env={
            # Ensure the server receives your Yachtsy API key
            "YACHTSY_API_KEY": os.environ.get("YACHTSY_API_KEY", "YOUR_API_KEY_HERE"),
        }
    )

    # Connect to the server
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # Initialize the connection
            await session.initialize()
            print("Connected to Yachtsy MCP server")

            # List available tools
            tools = await session.list_tools()
            print("Available tools:")
            for tool in tools.tools:
                print(f"- {tool.name}: {tool.description}")

            # Validated prompt 1
            print("\nTell me more about Tayana 37...")
            p1 = await session.call_tool(
                "yachtsy-agent",
                arguments={"prompt": "Tell me more about Tayana 37"}
            )
            print(p1.content[0].text)

            # Validated prompt 2
            print("\nShow me Tayana 37 listings for sale...")
            p2 = await session.call_tool(
                "yachtsy-agent",
                arguments={"prompt": "Show me Tayana 37 listings for sale"}
            )
            print(p2.content[0].text)

            # Validated prompt 3
            print("\nFind 30-40ft sailboats under $50k in Charleston, SC...")
            p3 = await session.call_tool(
                "yachtsy-agent",
                arguments={"prompt": "Find 30-40ft sailboats under $50k in Charleston, SC"}
            )
            print(p3.content[0].text)

            # Validated prompt 4
            print("\nTide chart for Charleston today...")
            p4 = await session.call_tool(
                "yachtsy-agent",
                arguments={"prompt": "Tide chart for Charleston today"}
            )
            print(p4.content[0].text)

if __name__ == "__main__":
    asyncio.run(main()) 