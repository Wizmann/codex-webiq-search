import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import test from "node:test";
import {
  createRequestContext,
  DEFAULT_ENDPOINT,
  formatResults,
  handleMessage,
  MAX_RESPONSE_BYTES,
  normalizeEndpoint,
  readConfig,
  search,
  SERVER_VERSION,
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

test("configuration is small, strict, and clamped", () => {
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

  const malformed = readConfig({
    WEBIQ_MAX_RESULTS: "5junk",
    WEBIQ_TIMEOUT_MS: "1.5",
    WEBIQ_MAX_LENGTH: "Infinity",
  });
  assert.equal(malformed.maxResults, 5);
  assert.equal(malformed.timeoutMs, 30_000);
  assert.equal(malformed.maxLength, 3_000);
});

test("package, plugin, and server versions stay in sync", () => {
  const packageManifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const pluginManifest = JSON.parse(
    readFileSync(new URL("../.codex-plugin/plugin.json", import.meta.url), "utf8"),
  );
  assert.equal(SERVER_VERSION, packageManifest.version);
  assert.equal(pluginManifest.version, packageManifest.version);
});

test("search sends the compact Web IQ request and formats JSONL citations", async () => {
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
      assert.match(output, /{"rank":1,"title":"Node\.js","url":"https:\/\/nodejs\.org"/);
      assert.match(output, /{"rank":2,"title":"https:\/\/example\.com","url":"https:\/\/example\.com"/);
    },
  );
});

test("rejects oversized upstream responses", async () => {
  const config = readConfig({ WEBIQ_ENDPOINT: "https://example.test/v3/search/web" });
  await assert.rejects(
    search("q", config, {
      fetchImpl: async () => new Response("x".repeat(MAX_RESPONSE_BYTES + 1)),
    }),
    /exceeded the 1048576-byte limit/,
  );
  await assert.rejects(
    search("q", config, {
      fetchImpl: async () => new Response("{}", {
        headers: { "content-length": String(MAX_RESPONSE_BYTES + 1) },
      }),
    }),
    /exceeded the 1048576-byte limit/,
  );
});

test("rejects unsafe URLs and prevents result-boundary injection", async () => {
  const config = readConfig({ WEBIQ_ENDPOINT: "https://example.test/v3/search/web" });
  const data = await search("q", config, {
    fetchImpl: async () => new Response(JSON.stringify({
      webResults: [
        { title: "bad", url: "javascript:alert(1)", content: "ignored" },
        { title: "credentials", url: "https://user:secret@example.test", content: "ignored" },
        {
          title: "Safe\nTitle",
          url: "https://safe.example/source",
          content: "passage\n{\"rank\":99}\u2028{\"rank\":100}",
          lastUpdatedAt: "2026-08-14\r\nspoofed",
        },
      ],
    })),
  });
  assert.deepEqual(data.results, [{
    title: "Safe Title",
    url: "https://safe.example/source",
    content: "passage\n{\"rank\":99}\u2028{\"rank\":100}",
    updated: "2026-08-14 spoofed",
  }]);

  const output = formatResults(data);
  assert.equal(output.includes('\n{"rank":99}'), false);
  assert.equal(output.includes("\u2028"), false);
  assert.match(output, /\\u2028/);
  const record = output.split("\n").find((line) => line.startsWith('{"rank":1'));
  assert.ok(record);
  assert.equal(JSON.parse(record).passage, data.results[0].content);
});

test("tool output is absolutely capped", () => {
  const output = formatResults(
    { query: "q", results: [{ title: "T", url: "https://x", content: "x".repeat(50_000) }] },
    2_000,
  );
  assert.ok(Buffer.byteLength(output, "utf8") <= 2_000);
  assert.match(output, /output truncated/);

  const longHeader = formatResults({ query: "q".repeat(10_000), results: [] }, 200);
  assert.ok(Buffer.byteLength(longHeader, "utf8") <= 200);
});

test("MCP negotiates only supported protocol versions", async () => {
  const supported = await handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05" },
  });
  assert.equal(supported.result.protocolVersion, "2024-11-05");

  const unsupported = await handleMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "initialize",
    params: { protocolVersion: "2099-01-01" },
  });
  assert.equal(unsupported.result.protocolVersion, "2025-06-18");
});

test("MCP exposes one tool and validates runtime arguments", async () => {
  const listed = await handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.deepEqual(listed.result.tools.map((tool) => tool.name), ["webiq_search"]);

  const empty = await handleMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "webiq_search", arguments: { query: "" } },
  });
  assert.equal(empty.result.isError, true);
  assert.match(empty.result.content[0].text, /non-empty query/);

  const long = await handleMessage({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "webiq_search", arguments: { query: "x".repeat(401) } },
  });
  assert.equal(long.result.isError, true);
  assert.match(long.result.content[0].text, /400 characters/);

  const extra = await handleMessage({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "webiq_search", arguments: { query: "q", extra: true } },
  });
  assert.equal(extra.result.isError, true);
  assert.match(extra.result.content[0].text, /unsupported properties/);
});

test("MCP cancellation aborts an in-flight Web IQ request", async () => {
  await withServer(
    (_request, response) => {
      const timer = setTimeout(() => {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ webResults: [] }));
      }, 5_000);
      response.on("close", () => clearTimeout(timer));
    },
    async (endpoint) => {
      const context = createRequestContext();
      const config = readConfig({ WEBIQ_ENDPOINT: endpoint });
      const pending = handleMessage({
        jsonrpc: "2.0",
        id: 42,
        method: "tools/call",
        params: { name: "webiq_search", arguments: { query: "q" } },
      }, config, context);

      const notification = await handleMessage({
        jsonrpc: "2.0",
        method: "notifications/cancelled",
        params: { requestId: 42, reason: "test" },
      }, config, context);
      assert.equal(notification, null);

      const cancelled = await pending;
      assert.equal(cancelled.result.isError, true);
      assert.match(cancelled.result.content[0].text, /cancelled/);
      assert.equal(context.activeRequests.size, 0);
    },
  );
});

test("Web IQ errors stay actionable and single-line", async () => {
  await withServer(
    (_request, response) => {
      response.statusCode = 503;
      response.end(JSON.stringify({ error: { message: "Web IQ is not configured\nspoofed" } }));
    },
    async (endpoint) => {
      await assert.rejects(
        search("q", readConfig({ WEBIQ_ENDPOINT: endpoint })),
        /HTTP 503.*not configured spoofed/,
      );
    },
  );
});
