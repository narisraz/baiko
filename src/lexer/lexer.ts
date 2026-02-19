export enum TokenType {
  // Literals
  Number = "Number",
  String = "String",
  Identifier = "Identifier",

  // Keywords
  Asa = "Asa",           // function definition
  Raha = "Raha",         // if
  Ankoatra = "Ankoatra", // else
  Mamoaka = "Mamoaka",   // return
  Dia = "Dia",           // then / block open
  Farany = "Farany",     // end / block close
  Asehoy = "Asehoy",     // print
  Avereno = "Avereno",   // while (part 1 of "avereno raha")

  // Boolean literals
  True = "True",         // marina (vrai)
  False = "False",       // diso (faux)

  // Logical operators
  And = "And",           // ary (et)
  Or = "Or",             // na (ou)
  Not = "Not",           // tsy (non)

  // Types
  Isa = "Isa",           // Number
  Soratra = "Soratra",   // String
  Marina = "Marina",     // Boolean

  // Arithmetic operators
  Plus = "Plus",         // +
  Minus = "Minus",       // -
  Star = "Star",         // *
  Slash = "Slash",       // /

  // Comparison operators
  EqualEqual = "EqualEqual",     // ==
  BangEqual = "BangEqual",       // !=
  Less = "Less",                 // <
  LessEqual = "LessEqual",       // <=
  Greater = "Greater",           // >
  GreaterEqual = "GreaterEqual", // >=

  // Assignment
  Equal = "Equal",       // =

  // Delimiters
  LeftParen = "LeftParen",   // (
  RightParen = "RightParen", // )
  Colon = "Colon",           // :
  Comma = "Comma",           // ,
  Semicolon = "Semicolon",   // ;

  EOF = "EOF",
}

const KEYWORDS: Record<string, TokenType> = {
  asa:      TokenType.Asa,
  raha:     TokenType.Raha,
  ankoatra: TokenType.Ankoatra,
  mamoaka:  TokenType.Mamoaka,
  dia:      TokenType.Dia,
  farany:   TokenType.Farany,
  asehoy:   TokenType.Asehoy,
  avereno:  TokenType.Avereno,  // used in "avereno raha" (while)
  marina:   TokenType.True,
  diso:     TokenType.False,
  ary:      TokenType.And,
  na:       TokenType.Or,
  tsy:      TokenType.Not,
  Isa:      TokenType.Isa,
  Soratra:  TokenType.Soratra,
  Marina:   TokenType.Marina,
};

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.source.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.source.length) break;
      tokens.push(this.nextToken());
    }

    tokens.push({ type: TokenType.EOF, value: "", line: this.line, column: this.column });
    return tokens;
  }

  private nextToken(): Token {
    const ch = this.source[this.pos];
    const line = this.line;
    const col = this.column;

    if (this.isDigit(ch)) return this.readNumber(line, col);
    if (ch === '"')        return this.readString(line, col);
    if (this.isAlpha(ch)) return this.readWord(line, col);

    // Two-character operators
    const two = this.source.slice(this.pos, this.pos + 2);
    const twoMap: Record<string, TokenType> = {
      "==": TokenType.EqualEqual,
      "!=": TokenType.BangEqual,
      "<=": TokenType.LessEqual,
      ">=": TokenType.GreaterEqual,
    };
    if (twoMap[two]) {
      this.pos += 2;
      this.column += 2;
      return { type: twoMap[two], value: two, line, column: col };
    }

    // Single-character tokens
    const one: Record<string, TokenType> = {
      "+": TokenType.Plus,
      "-": TokenType.Minus,
      "*": TokenType.Star,
      "/": TokenType.Slash,
      "=": TokenType.Equal,
      "<": TokenType.Less,
      ">": TokenType.Greater,
      "(": TokenType.LeftParen,
      ")": TokenType.RightParen,
      ":": TokenType.Colon,
      ",": TokenType.Comma,
      ";": TokenType.Semicolon,
    };
    if (one[ch]) {
      this.advance();
      return { type: one[ch], value: ch, line, column: col };
    }

    throw new Error(`Unexpected character '${ch}' at ${line}:${col}`);
  }

  private readNumber(line: number, col: number): Token {
    let value = "";
    while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
      value += this.advance();
    }
    if (this.source[this.pos] === ".") {
      value += this.advance();
      while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
        value += this.advance();
      }
    }
    return { type: TokenType.Number, value, line, column: col };
  }

  private readString(line: number, col: number): Token {
    this.advance(); // skip opening "
    let value = "";
    while (this.pos < this.source.length && this.source[this.pos] !== '"') {
      if (this.source[this.pos] === "\\") {
        this.advance();
        const esc = this.advance();
        value += esc === "n" ? "\n" : esc === "t" ? "\t" : esc;
      } else {
        value += this.advance();
      }
    }
    if (this.pos >= this.source.length) {
      throw new Error(`Unterminated string at ${line}:${col}`);
    }
    this.advance(); // skip closing "
    return { type: TokenType.String, value, line, column: col };
  }

  private readWord(line: number, col: number): Token {
    let value = "";
    while (this.pos < this.source.length && this.isAlphaNumeric(this.source[this.pos])) {
      value += this.advance();
    }
    const keyword = KEYWORDS[value];
    return { type: keyword ?? TokenType.Identifier, value, line, column: col };
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];

      // Skip whitespace
      if (/\s/.test(ch)) {
        if (ch === "\n") { this.line++; this.column = 1; } else { this.column++; }
        this.pos++;
        continue;
      }

      // Skip single-line comments starting with #
      if (ch === "#") {
        while (this.pos < this.source.length && this.source[this.pos] !== "\n") {
          this.pos++;
        }
        continue;
      }

      break;
    }
  }

  private advance(): string {
    const ch = this.source[this.pos++];
    this.column++;
    return ch;
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private isAlpha(ch: string): boolean {
    return /[a-zA-Z_]/.test(ch);
  }

  private isAlphaNumeric(ch: string): boolean {
    return /[a-zA-Z0-9_]/.test(ch);
  }
}
