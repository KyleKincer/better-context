#!/usr/bin/env bun
/**
 * btca MCP Server
 *
 * A Model Context Protocol (MCP) server that wraps the btca server API.
 * This enables LibreChat and other MCP-compatible clients to query
 * documentation and code from configured Git repositories.
 *
 * Usage:
 *   BTCA_SERVER_URL=http://btca-server bun run src/index.ts
 *
 * Environment Variables:
 *   BTCA_SERVER_URL - URL of the btca server (default: http://localhost:8080)
 *
 * Tools:
 *   - ask: Ask a question about configured documentation/code repositories
 *   - listResources: List available documentation resources
 *   - getConfig: Get current btca server configuration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	ListToolsRequestSchema,
	CallToolRequestSchema,
	type CallToolResult
} from '@modelcontextprotocol/sdk/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const BTCA_SERVER_URL = process.env.BTCA_SERVER_URL || 'http://localhost:8080';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface BtcaResource {
	name: string;
	type: 'git' | 'local';
	url?: string;
	path?: string;
	branch?: string;
	searchPath?: string | null;
	searchPaths?: string[] | null;
	specialNotes?: string | null;
}

interface BtcaConfig {
	provider: string;
	model: string;
	providerTimeoutMs: number | null;
	resourcesDirectory: string;
	collectionsDirectory: string;
	resourceCount: number;
}

interface BtcaQuestionResponse {
	answer: string;
	model: string;
	resources: string[];
	collection: {
		key: string;
		path: string;
	};
}

interface BtcaResourcesResponse {
	resources: BtcaResource[];
}

// ─────────────────────────────────────────────────────────────────────────────
// API Client
// ─────────────────────────────────────────────────────────────────────────────

async function fetchFromBtca<T>(
	endpoint: string,
	options?: RequestInit
): Promise<T> {
	const url = `${BTCA_SERVER_URL}${endpoint}`;
	const response = await fetch(url, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...options?.headers
		}
	});

	if (!response.ok) {
		const errorBody = await response.text();
		throw new Error(
			`btca server error (${response.status}): ${errorBody || response.statusText}`
		);
	}

	return response.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP Server
// ─────────────────────────────────────────────────────────────────────────────

const server = new Server(
	{
		name: 'btca-mcp',
		version: '1.0.0'
	},
	{
		capabilities: {
			tools: {}
		}
	}
);

// Register tool listing handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
	return {
		tools: [
			{
				name: 'ask',
				description:
					'Ask a question about configured documentation and code repositories. ' +
					'The btca server will search through the configured resources and use AI ' +
					'to generate an answer based on the relevant documentation.',
				inputSchema: {
					type: 'object',
					properties: {
						question: {
							type: 'string',
							description: 'The question to ask about the documentation/codebase'
						},
						resources: {
							type: 'array',
							items: { type: 'string' },
							description:
								'Optional list of resource names to query. If not specified, all configured resources will be searched.'
						}
					},
					required: ['question']
				}
			},
			{
				name: 'listResources',
				description:
					'List all available documentation resources configured in the btca server. ' +
					'Returns information about each resource including name, type, URL/path, and any special notes.',
				inputSchema: {
					type: 'object',
					properties: {}
				}
			},
			{
				name: 'getConfig',
				description:
					'Get the current btca server configuration including the LLM provider, model, and resource count.',
				inputSchema: {
					type: 'object',
					properties: {}
				}
			}
		]
	};
});

// Register tool call handler
server.setRequestHandler(
	CallToolRequestSchema,
	async (request): Promise<CallToolResult> => {
		const { name, arguments: args } = request.params;

		try {
			switch (name) {
				case 'listResources': {
					const data = await fetchFromBtca<BtcaResourcesResponse>('/resources');
					const formatted = data.resources
						.map((r) => {
							const lines = [`- ${r.name} (${r.type})`];
							if (r.url) lines.push(`  URL: ${r.url}`);
							if (r.path) lines.push(`  Path: ${r.path}`);
							if (r.branch) lines.push(`  Branch: ${r.branch}`);
							if (r.searchPath) lines.push(`  Search Path: ${r.searchPath}`);
							if (r.searchPaths) lines.push(`  Search Paths: ${r.searchPaths.join(', ')}`);
							if (r.specialNotes) lines.push(`  Notes: ${r.specialNotes}`);
							return lines.join('\n');
						})
						.join('\n\n');

					return {
						content: [
							{
								type: 'text',
								text: `Available Resources (${data.resources.length}):\n\n${formatted}`
							}
						]
					};
				}

				case 'getConfig': {
					const config = await fetchFromBtca<BtcaConfig>('/config');
					return {
						content: [
							{
								type: 'text',
								text: [
									'btca Server Configuration:',
									`  Provider: ${config.provider}`,
									`  Model: ${config.model}`,
									`  Timeout: ${config.providerTimeoutMs ?? 'default'}ms`,
									`  Resources: ${config.resourceCount} configured`
								].join('\n')
							}
						]
					};
				}

				case 'ask': {
					const typedArgs = args as { question: string; resources?: string[] };
					if (!typedArgs.question || typeof typedArgs.question !== 'string') {
						throw new Error('Missing required parameter: question');
					}

					const response = await fetchFromBtca<BtcaQuestionResponse>(
						'/question',
						{
							method: 'POST',
							body: JSON.stringify({
								question: typedArgs.question,
								resources: typedArgs.resources
							})
						}
					);

					return {
						content: [
							{
								type: 'text',
								text: response.answer
							}
						]
					};
				}

				default:
					throw new Error(`Unknown tool: ${name}`);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				content: [
					{
						type: 'text',
						text: `Error: ${message}`
					}
				],
				isError: true
			};
		}
	}
);

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
	// Log to stderr so it doesn't interfere with MCP protocol on stdout
	console.error(`btca-mcp server starting (btca URL: ${BTCA_SERVER_URL})`);

	const transport = new StdioServerTransport();
	await server.connect(transport);

	console.error('btca-mcp server connected via stdio');
}

main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
