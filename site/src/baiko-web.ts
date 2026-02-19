import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { Interpreter } from "../../src/interpreter/interpreter";

export function runBaiko(code: string): string {
  const lines: string[] = [];
  const interpreter = new Interpreter((value: string) => {
    lines.push(value);
  }, noopResolver, noopPackageResolver);
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const program = parser.parse();
  interpreter.run(program);
  return lines.join("\n");
}

export interface BaikoCheckError {
  message: string;
  line: number | null; // 1-based, null if unknown
  col: number | null;  // 1-based, null if unknown
}

// Dans le navigateur, les fichiers ne peuvent pas être lus et les packages npm
// ne sont pas disponibles : on utilise des résolveurs no-op.
const noopResolver = (_path: string): string => "";
const noopPackageResolver = (_: string): unknown =>
  new Proxy({} as Record<string, unknown>, { get: () => (..._a: unknown[]) => null });

export function checkBaiko(code: string): BaikoCheckError[] {
  try {
    const tokens = new Lexer(code).tokenize();
    const program = new Parser(tokens).parse();
    new Interpreter(undefined, noopResolver, noopPackageResolver).run(program);
    return [];
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const posMatch = message.match(/\(andalana (\d+), toerana (\d+)\)/);
    return [{
      message,
      line: posMatch ? parseInt(posMatch[1]) : null,
      col:  posMatch ? parseInt(posMatch[2]) : null,
    }];
  }
}
