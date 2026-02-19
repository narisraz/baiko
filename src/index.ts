import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";
import { Lexer } from "./lexer/lexer";
import { Parser } from "./parser/parser";
import { Generator } from "./generator/generator";

function compile(source: string): string {
  const tokens = new Lexer(source).tokenize();
  const ast = new Parser(tokens).parse();
  return new Generator().generate(ast);
}

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: baiko [--run] <file>");
  console.error("  --run   compile et exécute le programme");
  process.exit(1);
}

const runFlag = args[0] === "--run";
const filePath = path.resolve(runFlag ? args[1] : args[0]);

if (!filePath) {
  console.error("Erreur: fichier manquant");
  process.exit(1);
}

const source = fs.readFileSync(filePath, "utf-8");

try {
  const js = compile(source);

  if (runFlag) {
    vm.runInNewContext(js, { console });
  } else {
    console.log(js);
  }
} catch (err) {
  console.error("Erreur:", (err as Error).message);
  process.exit(1);
}
