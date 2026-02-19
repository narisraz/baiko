import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";
import { Lexer } from "./lexer/lexer";
import { Parser } from "./parser/parser";
import { Generator } from "./generator/generator";
import { Interpreter, RuntimeError } from "./interpreter/interpreter";

function parse(source: string) {
  const tokens = new Lexer(source).tokenize();
  return new Parser(tokens).parse();
}

const args = process.argv.slice(2);

const USAGE = `
Fampiasana: baiko <fomba> <rakitra>

Fomba:
  --compile     asehoy ny JavaScript vokarina  (voalohany)
  --run         vakio sy ataovy amin'ny alalan'i Node
  --interpret   ataovy mivantana ny AST (mpandrindra natif)
`.trim();

if (args.length === 0) {
  console.error("Hadisoana: tsy nomena rakitra.\n\n" + USAGE);
  process.exit(1);
}

const flag     = args[0].startsWith("--") ? args[0] : "--compile";
const filePath = path.resolve(args[0].startsWith("--") ? args[1] : args[0]);

if (!filePath) {
  console.error("Hadisoana: tsy nomena ny anarana ny rakitra.\n\n" + USAGE);
  process.exit(1);
}

const source = fs.readFileSync(filePath, "utf-8");

try {
  const ast = parse(source);

  switch (flag) {
    case "--compile":
    default: {
      console.log(new Generator().generate(ast));
      break;
    }
    case "--run": {
      const js = new Generator().generate(ast);
      vm.runInNewContext(js, { console });
      break;
    }
    case "--interpret": {
      new Interpreter().run(ast);
      break;
    }
  }
} catch (err) {
  const prefix = err instanceof RuntimeError ? "Hadisoana amin'ny fanatanterahana" : "Hadisoana";
  console.error(`${prefix}: ${(err as Error).message}`);
  process.exit(1);
}
