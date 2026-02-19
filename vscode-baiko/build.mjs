import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/check.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile: "baiko-check.js",
  tsconfig: "../tsconfig.json",
  minify: true,
});

console.log("Built baiko-check.js");
