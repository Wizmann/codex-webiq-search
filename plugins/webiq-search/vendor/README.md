# Vendored TOML parser

`toml.mjs` bundles the `parse` export of [smol-toml 1.9.0](https://github.com/squirrelchat/smol-toml),
under the BSD-3-Clause license in `toml.LICENSE`. It is checked in so the installed plugin
can read Codex configuration without installing npm packages.

To regenerate from the locked development dependencies:

```powershell
npm ci
npm run vendor:toml
```
