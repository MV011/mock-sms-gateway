#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools.js';

const SMS_MOCK_URL = process.env.SMS_MOCK_URL ?? 'http://localhost:8026';
const API_KEY = process.env.API_KEY;

const server = new McpServer({
  name: 'mock-sms-gateway',
  version: '1.0.0',
});

registerTools(server, SMS_MOCK_URL, API_KEY);

const transport = new StdioServerTransport();
try {
  await server.connect(transport);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`MCP server failed to start: ${message}\n`);
  process.exit(1);
}
