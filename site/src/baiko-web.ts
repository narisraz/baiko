import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { Interpreter } from "../../src/interpreter/interpreter";

export function runBaiko(code: string): string {
  const lines: string[] = [];

  const interpreter = new Interpreter((value: string) => {
    lines.push(value);
  });

  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parse();
  interpreter.run(program);

  return lines.join("\n");
}
