import * as esbuild from "esbuild";
import { argv } from "process";

const watch = argv.includes("--watch");

const ctx = await esbuild.context({
  entryPoints: ["src/baiko-web.ts"],
  bundle: true,
  format: "iife",
  globalName: "BaikoWeb",
  outfile: "dist/baiko.js",
  sourcemap: true,
  minify: !watch,
  tsconfig: "../tsconfig.json",
});

if (watch) {
  await ctx.watch();
  console.log("Watching for changes…");
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log("Build done → dist/baiko.js");
}
