import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import {
  DEFAULT_ENDPOINT,
  formatResults,
  handleMessage,
  normalizeEndpoint,
  readConfig,
  search,
} from "../server.mjs";

async function withServer(handler, run) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}/v3/search/web`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("configuration is small and clamped", () => {
  assert.equal(readConfig({}).endpoint, DEFAULT_ENDPOINT);
  assert.equal(normalizeEndpoint("https://api.microsoft.ai"), "https://api.microsoft.ai/v3/search/web");
  const config = readConfig({
    WEBIQ_ENDPOINT: "https://api.microsoft.ai",
    WEBIQ_API_KEY: " key ",
    WEBIQ_MAX_RESULTS: "99",
    WEBIQ_TIMEOUT_MS: "1",
  });
  assert.equal(config.apiKey, "key");
  assert.equal(config.maxResults, 10);
  assert.equal(config.timeoutMs, 1_000);
});

test("search sends the compact Web IQ request and formats citations", async () => {
  await withServer(
    async (request, response) => {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      assert.deepEqual(JSON.parse(raw), {
        query: "latest node release",
        maxResults: 2,
        contentFormat: "passage",
        maxLength: 3000,
      });
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ webResults: [
        { title: "Node.js", url: "https://nodejs.org", content: "Current release" },
        { url: "https://example.com", snippet: "Fallback snippet" },
      ] }));
    },
    async (endpoint) => {
      const data = await search(" latest node release ", readConfig({ WEBIQ_ENDPOINT: endpoint }), {
        maxResults: 2,
      });
      const output = formatResults(data);
      assert.match(output, /Untrusted web content/);
      assert.match(output, /\[1\] Node\.js\nhttps:\/\/nodejs\.org/);
      assert.match(output, /\[2\] https:\/\/example\.com/);
    },
  );
});

test("tool output is capped", () => {
  const output = formatResults(
    { query: "q", results: [{ title: "T", url: "https://x", content: "x".repeat(50_000) }] },
    2_000,
  );
  assert.ok(Buffer.byteLength(output, "utf8") <= 2_000);
  assert.match(output, /output truncated/);
});

test("MCP exposes exactly one tool and returns tool errors as results", async () => {
  const listed = await handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.deepEqual(listed.result.tools.map((tool) => tool.name), ["webiq_search"]);
  const failed = await handleMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "webiq_search", arguments: { query: "" } },
  });
  assert.equal(failed.result.isError, true);
  assert.match(failed.result.content[0].text, /non-empty query/);
});

test("Web IQ errors stay actionable", async () => {
  await withServer(
    (_request, response) => {
      response.statusCode = 503;
      response.end(JSON.stringify({ error: { message: "Web IQ is not configured" } }));
    },
    async (endpoint) => {
      await assert.rejects(
        search("q", readConfig({ WEBIQ_ENDPOINT: endpoint })),
        /HTTP 503.*not configured/,
      );
    },
  );
});
