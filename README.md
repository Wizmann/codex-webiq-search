# codex-webiq-search

A lightweight Codex web search plugin backed by Microsoft Web IQ, with no runtime
npm installation or build step.

The plugin exposes one read-only MCP tool, `webiq_search`. Unless `WEBIQ_ENDPOINT`
is set, it reads the selected model provider's `base_url` from Codex's user
configuration and replaces a trailing `/v1/` with `/v3/search/web`. For example,
`http://gateway.example:8313/v1/` becomes
`http://gateway.example:8313/v3/search/web`, preserving any gateway path prefix.

## Install

```powershell
codex plugin marketplace add sxwxs/codex-webiq-search
codex plugin add webiq-search@sxw-webiq
```

Start a new Codex session after installation. If you publish this repository
under another GitHub owner, replace `sxwxs` in the first command.

## Search backend

Use a model gateway such as [`ghc-api`](https://github.com/sxwxs/ghc-api) with
Web IQ enabled. The plugin reads `$CODEX_HOME/config.toml` (default
`~/.codex/config.toml`) and follows `model_provider` to
`model_providers.<id>.base_url`. For the built-in OpenAI provider,
`openai_base_url` is also supported. It reloads this configuration on each search.
Session-only overrides and separately selected profile files are not inferred.

If the model provider does not support Web IQ, configure a separate search
backend with `WEBIQ_ENDPOINT`. Direct Microsoft access remains supported:

```powershell
$env:WEBIQ_ENDPOINT = "https://api.microsoft.ai"
$env:WEBIQ_API_KEY = "..."
```

See [the plugin README](./plugins/webiq-search/README.md) for all configuration
variables and behavior.

## Privacy

Search queries are sent to the explicit `WEBIQ_ENDPOINT` or the endpoint derived
from the selected model provider's `base_url`. They may leave the machine and be
logged by that service. Do not include passwords, tokens, private keys, or other
sensitive data in search queries.

Search credentials are read from `WEBIQ_API_KEY` and `WEBIQ_TOKEN` and sent only
as request headers to the search endpoint. Model-provider authentication is not
copied. Missing or invalid configuration produces an actionable tool error;
the plugin does not silently default to localhost.

## Development

```powershell
cd plugins/webiq-search
npm test
```

Requires Node.js 20.11 or newer. No npm install or build step is needed to run the
plugin or its tests. A TOML parser is bundled in the plugin; see
[its vendoring instructions](./plugins/webiq-search/vendor/README.md) to regenerate it.
