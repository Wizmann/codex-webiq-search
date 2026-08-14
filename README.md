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

## Development

```powershell
cd plugins/webiq-search
npm test
```

Requires Node.js 20.11 or newer. No npm install or build step is needed.
