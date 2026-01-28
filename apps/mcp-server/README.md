# btca MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that wraps the btca server API. This enables LibreChat and other MCP-compatible clients to query documentation and code from configured Git repositories.

## Architecture

```
LibreChat/Claude Desktop → btca-mcp (stdio) → btca-server (HTTP) → Git repos
```

The MCP server acts as a thin wrapper, translating MCP tool calls into btca API requests.

## Installation

```bash
cd apps/mcp-server
bun install
```

## Usage

### Standalone

```bash
# Start btca-server first
bun run apps/server/src/index.ts

# In another terminal, start the MCP server
BTCA_SERVER_URL=http://localhost:8080 bun run apps/mcp-server/src/index.ts
```

### With LibreChat

Add to your LibreChat MCP configuration:

```json
{
  "mcpServers": {
    "btca": {
      "command": "bun",
      "args": ["run", "/path/to/apps/mcp-server/src/index.ts"],
      "env": {
        "BTCA_SERVER_URL": "http://btca-server"
      }
    }
  }
}
```

### With Claude Desktop

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "btca": {
      "command": "bun",
      "args": ["run", "/path/to/apps/mcp-server/src/index.ts"],
      "env": {
        "BTCA_SERVER_URL": "http://localhost:8080"
      }
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BTCA_SERVER_URL` | `http://localhost:8080` | URL of the btca server |

## Available Tools

### `ask`

Ask a question about configured documentation and code repositories.

**Parameters:**
- `question` (required): The question to ask
- `resources` (optional): Array of resource names to query (defaults to all)

**Example:**
```json
{
  "question": "How do I set up authentication?",
  "resources": ["internal-api"]
}
```

### `listResources`

List all available documentation resources configured in the btca server.

**Parameters:** None

### `getConfig`

Get the current btca server configuration including the LLM provider, model, and resource count.

**Parameters:** None

## Kubernetes Deployment

When deploying to Kubernetes, the MCP server typically runs as a sidecar to LibreChat or as a separate deployment that LibreChat connects to.

For the recommended architecture (btca-server as a standalone service), you don't need to deploy the MCP server separately if LibreChat supports direct HTTP-based tool calling. The MCP server is primarily useful for:

1. Local development with Claude Desktop
2. MCP clients that require stdio transport
3. Scenarios where you need to add custom tool logic

See `deploy/k8s/btca-server.yaml` for the Kubernetes manifests.
