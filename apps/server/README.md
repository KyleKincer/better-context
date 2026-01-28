# btca-server

BTCA (Better Context AI) server for answering questions about your codebase using OpenCode AI.

## Installation

```bash
bun add btca-server
```

## Usage

### Starting the Server

```typescript
import { startServer } from 'btca-server';

// Start with default options (port 8080 or process.env.PORT)
const server = await startServer();
console.log(`Server running at ${server.url}`);

// Start with custom port
const server = await startServer({ port: 3000 });

// Start with quiet mode (no logging)
const server = await startServer({ port: 3000, quiet: true });

// Stop the server when needed
server.stop();
```

### Server Instance

The `startServer` function returns a `ServerInstance` object:

```typescript
interface ServerInstance {
	port: number; // Actual port the server is running on
	url: string; // Full URL (e.g., "http://localhost:8080")
	stop: () => void; // Function to stop the server
}
```

### Random Port Assignment

You can pass `port: 0` to let the OS assign a random available port:

```typescript
const server = await startServer({ port: 0 });
console.log(`Server running on port ${server.port}`);
```

## API Endpoints

Once the server is running, it exposes the following REST API endpoints:

### Health Check

```
GET /
```

Returns service status and version info.

### Configuration

```
GET /config
```

Returns current configuration (provider, model, resources).

### Resources

```
GET /resources
```

Lists all configured resources (local directories or git repositories).

```
POST /config/resources
```

Add a new resource (git or local).

```
DELETE /config/resources
```

Remove a resource by name.

```
POST /clear
```

Clear all locally cloned resources.

### Questions

```
POST /question
```

Ask a question (non-streaming response).

```
POST /question/stream
```

Ask a question with streaming SSE response.

### OpenCode Instance

```
POST /opencode
```

Get an OpenCode instance URL for a collection of resources.

### Model Configuration

```
PUT /config/model
```

Update the AI provider and model configuration.

## Configuration

The server reads configuration from `~/.config/btca/btca.config.jsonc` (global) or `./btca.config.jsonc` (project-level). Project config overrides global config.

- **AI Provider**: LLM provider (e.g., "openai", "anthropic", "opencode")
- **Model**: AI model to use (e.g., "gpt-4o", "claude-sonnet-4-20250514")
- **Resources**: Local directories or git repositories to query

Example `btca.config.jsonc`:

```jsonc
{
  "$schema": "https://btca.dev/btca.schema.json",
  "provider": "openai",
  "model": "gpt-4o",
  "resources": [
    {
      "type": "git",
      "name": "my-docs",
      "url": "https://github.com/user/repo",
      "branch": "main",
      "searchPath": "docs"
    },
    {
      "type": "local",
      "name": "my-project",
      "path": "/path/to/my/project"
    }
  ]
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 8080) |
| `OPENAI_API_KEY` | Yes* | OpenAI API key |
| `ANTHROPIC_API_KEY` | Yes* | Anthropic API key |
| `BTCA_ALLOWED_GIT_HOSTS` | No | Comma-separated hostnames to allow (bypasses private IP check) |

*At least one LLM provider API key is required.

## Resource Sync Behavior

Git repositories are kept up-to-date automatically:

- **First query**: Repository is cloned (slower)
- **Subsequent queries**: Repository is fetched and reset to latest (faster, but hits remote on each query)

Repos are stored in `~/.local/share/btca/resources/` by default.

## Self-Hosted / Kubernetes Deployment

For deploying btca-server to Kubernetes (e.g., for integration with LibreChat):

### Docker

```bash
docker build -t btca-server -f apps/server/Dockerfile .
docker run -p 8080:8080 \
  -e BTCA_ALLOWED_GIT_HOSTS=gitlab.yourcompany.com \
  -e OPENAI_API_KEY=sk-xxx \
  -v /path/to/btca.config.jsonc:/home/btca/.config/btca/btca.config.jsonc:ro \
  -v /path/to/.git-credentials:/home/btca/.git-credentials:ro \
  btca-server
```

### Kubernetes

See `deploy/k8s/btca-server.yaml` for complete manifests including:
- ConfigMap for `btca.config.jsonc`
- Secrets for git credentials and API keys
- Deployment with health checks and resource limits
- Service (ClusterIP)

### GitLab Enterprise / Self-Hosted Git

To allow cloning from self-hosted GitLab instances that may resolve to private IPs from within the cluster:

```bash
BTCA_ALLOWED_GIT_HOSTS=gitlab.yourcompany.com,git.internal.corp
```

### Adding Resources (Kubernetes)

With ConfigMap-based configuration, to add a new repository:

1. Update the `resources` array in your Helm values or ConfigMap
2. Merge the change via your normal CI/CD process
3. The deployment redeploys with the new config

The first query to a new resource will clone it; subsequent queries fetch the latest.

## TypeScript Types

The package exports TypeScript types for use with Hono RPC client:

```typescript
import type { AppType } from 'btca-server';
import { hc } from 'hono/client';

const client = hc<AppType>('http://localhost:8080');
```

## Stream Types

For working with SSE streaming responses:

```typescript
import type { BtcaStreamEvent, BtcaStreamMetaEvent } from 'btca-server/stream/types';
```

## Requirements

- **Bun**: >= 1.1.0 (this package is designed specifically for Bun runtime)
- **OpenCode AI API Key**: Required for AI functionality

## License

MIT

## Repository

[https://github.com/bmdavis419/better-context](https://github.com/bmdavis419/better-context)
