import * as fs from "fs";
import * as path from "path";
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
  --run         ataovy mivantana ny AST (mpandrindra natif)
  --interpret   toy ny --run (mijanona ho fanampiny)
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
const dir = path.dirname(filePath);

// Résout les chemins d'import relatifs au fichier en cours
function makeResolver(baseDir: string) {
  return (importPath: string) => {
    const resolved = path.resolve(baseDir, importPath);
    return fs.readFileSync(resolved, "utf-8");
  };
}

try {
  const ast = parse(source);
  const resolver = makeResolver(dir);

  switch (flag) {
    case "--compile":
    default: {
      console.log(new Generator(resolver).generate(ast));
      break;
    }
    case "--run":
    case "--interpret": {
      new Interpreter(undefined, resolver).run(ast);
      break;
    }
  }
} catch (err) {
  const prefix = err instanceof RuntimeError ? "Hadisoana amin'ny fanatanterahana" : "Hadisoana";
  console.error(`${prefix}: ${(err as Error).message}`);
  process.exit(1);
}
