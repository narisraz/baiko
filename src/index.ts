import * as fs from "fs";
import * as path from "path";
import { Lexer } from "./lexer/lexer";
import { Parser } from "./parser/parser";
import { Generator } from "./generator/generator";

function compile(source: string): string {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  const parser = new Parser(tokens);
  const ast = parser.parse();

  const generator = new Generator();
  return generator.generate(ast);
}

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: baiko <file>");
  process.exit(1);
}

const filePath = path.resolve(args[0]);
const source = fs.readFileSync(filePath, "utf-8");

try {
  const output = compile(source);
  console.log(output);
} catch (err) {
  console.error("Compile error:", (err as Error).message);
  process.exit(1);
}
