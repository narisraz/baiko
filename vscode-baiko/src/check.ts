import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { Interpreter, FileResolver } from "../../src/interpreter/interpreter";

export interface BaikoError {
  message: string;
  line: number | null; // 1-based
  col: number | null;  // 1-based
}

// Dans VS Code, on ne peut pas résoudre les packages npm depuis l'extension.
// On utilise un Proxy permissif pour ne pas générer de faux diagnostics.
const noopPackageResolver = (_: string): unknown =>
  new Proxy({} as Record<string, unknown>, { get: () => (..._a: unknown[]) => null });

export function checkBaiko(code: string, resolver?: FileResolver): BaikoError[] {
  try {
    const tokens = new Lexer(code).tokenize();
    const program = new Parser(tokens).parse();
    new Interpreter(undefined, resolver, noopPackageResolver).run(program);
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
