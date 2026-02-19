import { Lexer } from "../../src/lexer/lexer";
import { Parser } from "../../src/parser/parser";
import { Interpreter } from "../../src/interpreter/interpreter";

export interface BaikoError {
  message: string;
  line: number | null; // 1-based
  col: number | null;  // 1-based
}

export function checkBaiko(code: string): BaikoError[] {
  try {
    const tokens = new Lexer(code).tokenize();
    const program = new Parser(tokens).parse();
    new Interpreter().run(program);
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
