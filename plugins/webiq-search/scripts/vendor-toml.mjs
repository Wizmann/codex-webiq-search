import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
mkdirSync(join(root, "vendor"), { recursive: true });
await build({
  stdin: {
    contents: 'export { parse } from "smol-toml";',
    resolveDir: root,
    sourcefile: "toml-entry.mjs",
  },
  outfile: join(root, "vendor/toml.mjs"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  minify: true,
  legalComments: "none",
  banner: { js: "// Generated from smol-toml 1.9.0 by npm run vendor:toml. See toml.LICENSE." },
});
copyFileSync(join(dirname(require.resolve("smol-toml")), "../LICENSE"), join(root, "vendor/toml.LICENSE"));
