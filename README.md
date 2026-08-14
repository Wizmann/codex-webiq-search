# codex-webiq-search

A lightweight, zero-dependency Codex web search plugin backed by Microsoft Web IQ.

The plugin exposes one read-only MCP tool, `webiq_search`, and defaults to a local
[`ghc-api`](https://github.com/sxwxs/ghc-api) endpoint at
`http://127.0.0.1:8313/v3/search/web`.

## Install

```powershell
codex plugin marketplace add sxwxs/codex-webiq-search
codex plugin add webiq-search@sxw-webiq
```

Start a new Codex session after installation. If you publish this repository
under another GitHub owner, replace `sxwxs` in the first command.

## Search backend

Run `ghc-api` locally with Web IQ enabled, or configure direct Microsoft access
before starting Codex:

```powershell
$env:WEBIQ_ENDPOINT = "https://api.microsoft.ai"
$env:WEBIQ_API_KEY = "..."
```

See [the plugin README](./plugins/webiq-search/README.md) for all configuration
variables and behavior.

## Privacy

Search queries are sent to `WEBIQ_ENDPOINT`. With the default configuration they
stay on the local machine and are handled by `ghc-api`. When using Microsoft Web
IQ directly or another proxy, queries leave the machine and may be logged by that
service. Do not include passwords, tokens, private keys, or other sensitive data
in search queries.

Credentials are read from environment variables and sent only as request headers
to the configured endpoint. They are not included in tool output.

## Development

```powershell
cd plugins/webiq-search
npm test
```

Requires Node.js 20.11 or newer. No npm install or build step is needed.
