import { Token, TokenType } from "../lexer/lexer";
import {
  Program,
  Statement,
  Expression,
  FunctionDeclaration,
  VariableDeclaration,
  Parameter,
  IfStatement,
  WhileStatement,
  ReturnStatement,
  PrintStatement,
  ExpressionStatement,
  IndexAssignmentStatement,
  AssignmentExpression,
  BinaryExpression,
  CallExpression,
  Identifier,
  NumericLiteral,
  StringLiteral,
  BooleanLiteral,
  TsisyLiteral,
  UnaryExpression,
  MemberCallExpression,
  MemberExpression,
  AwaitExpression,
  ListLiteral,
  IndexExpression,
  BaikoType,
  LisitraType,
  MetyType,
  VarType,
  ImportStatement,
} from "../types/ast";

const TYPE_TOKENS = new Set([TokenType.Isa, TokenType.Soratra, TokenType.Marina]);
const VAR_TYPE_STARTERS = new Set([...TYPE_TOKENS, TokenType.Mety, TokenType.Lisitra]);

const TOKEN_DESC: Partial<Record<TokenType, string>> = {
  [TokenType.Semicolon]:   '";" (famaranana ny tsipika)',
  [TokenType.Dia]:         '"dia" (fanombohana ny bloka)',
  [TokenType.Farany]:      '"farany" (famaranana ny bloka)',
  [TokenType.Ankoatra]:    '"ankoatra" (sampana hafa)',
  [TokenType.Equal]:       '"=" (fandrafesana)',
  [TokenType.EqualEqual]:  '"==" (fitoviana)',
  [TokenType.Colon]:       '":" (mari-karazana)',
  [TokenType.Comma]:       '"," (misaraka ny tohan-teny)',
  [TokenType.LeftParen]:   '"(" (fanombohana ny tohan-teny)',
  [TokenType.RightParen]:  '")" (famaranana ny tohan-teny)',
  [TokenType.Identifier]:  'anarana (identifier)',
  [TokenType.Isa]:         '"Isa" (karazana isa)',
  [TokenType.Soratra]:     '"Soratra" (karazana soratra)',
  [TokenType.Marina]:      '"Marina" (karazana boolean)',
  [TokenType.Mety]:        '"Mety" (karazana azo tsisy)',
  [TokenType.Raha]:        '"raha"',
  [TokenType.Avoaka]:      '"avoaka" (fanambaran\'ny avoaka)',
  [TokenType.Andrasana]:   '"andrasana" (asa tsy mitoky)',
};

function pos(line: number, col: number): string {
  return `(andalana ${line}, toerana ${col})`;
}

export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Program {
    const body: Statement[] = [];
    while (!this.isEOF()) {
      body.push(this.parseStatement());
    }
    return { type: "Program", body };
  }

  // ---- Statements ----

  private parseStatement(): Statement {
    // avoaka asa ... ou avoaka identifier: ...
    if (this.check(TokenType.Avoaka)) {
      return this.parseExportedStatement();
    }
    // "avereno raha" is the while keyword (compound)
    if (this.check(TokenType.Avereno) && this.tokens[this.pos + 1]?.type === TokenType.Raha) {
      return this.parseWhileStatement();
    }
    // "identifier : Type =" ou "identifier : Mety(...)" ou "identifier : Lisitra(...)" → déclaration typée
    if (
      this.check(TokenType.Identifier) &&
      this.tokens[this.pos + 1]?.type === TokenType.Colon &&
      VAR_TYPE_STARTERS.has(this.tokens[this.pos + 2]?.type)
    ) {
      return this.parseVariableDeclaration();
    }
    // "identifier [ expr ] = expr ;" → index assignment
    if (
      this.check(TokenType.Identifier) &&
      this.tokens[this.pos + 1]?.type === TokenType.LeftBracket
    ) {
      const saved = this.pos;
      try {
        const stmt = this.tryParseIndexAssignment();
        if (stmt) return stmt;
      } catch {
        this.pos = saved;
      }
    }
    switch (this.peek().type) {
      case TokenType.Asa:        return this.parseFunctionDeclaration();
      case TokenType.Andrasana:  return this.parseAsyncFunctionDeclaration();
      case TokenType.Raha:       return this.parseIfStatement();
      case TokenType.Mamoaka:    return this.parseReturnStatement();
      case TokenType.Asehoy:     return this.parsePrintStatement();
      case TokenType.Ampidiro:   return this.parseImportStatement();
      default:                   return this.parseExpressionStatement();
    }
  }

  /** andrasana asa name(...) dia ... farany */
  private parseAsyncFunctionDeclaration(): FunctionDeclaration {
    this.expect(TokenType.Andrasana);
    const fn = this.parseFunctionDeclaration();
    fn.async = true;
    return fn;
  }

  /** avoaka asa ... / avoaka andrasana asa ... / avoaka identifier: ... */
  private parseExportedStatement(): FunctionDeclaration | VariableDeclaration {
    this.expect(TokenType.Avoaka);
    if (this.check(TokenType.Andrasana)) {
      const fn = this.parseAsyncFunctionDeclaration();
      fn.exported = true;
      return fn;
    }
    if (this.check(TokenType.Asa)) {
      const fn = this.parseFunctionDeclaration();
      fn.exported = true;
      return fn;
    }
    if (
      this.check(TokenType.Identifier) &&
      this.tokens[this.pos + 1]?.type === TokenType.Colon &&
      VAR_TYPE_STARTERS.has(this.tokens[this.pos + 2]?.type)
    ) {
      const varDecl = this.parseVariableDeclaration();
      varDecl.exported = true;
      return varDecl;
    }
    const tok = this.peek();
    throw new Error(
      `"avoaka" tokony hitohana "asa" na fanambarana karazana — "${tok.value}" no noraisina ${pos(tok.line, tok.column)}`
    );
  }

  /** asa name(param: Type, ...): ReturnType dia ... farany */
  private parseFunctionDeclaration(): FunctionDeclaration {
    this.expect(TokenType.Asa);
    const name = this.expect(TokenType.Identifier).value;
    this.expect(TokenType.LeftParen);
    const params = this.parseParams();
    this.expect(TokenType.RightParen);

    let returnType: BaikoType | null = null;
    if (this.match(TokenType.Colon)) {
      returnType = this.parseBaseType();
    }

    this.expect(TokenType.Dia);
    const body = this.parseBlock();
    this.expect(TokenType.Farany);

    return { type: "FunctionDeclaration", name, params, returnType, body, exported: false, async: false };
  }

  /** x: Isa = expr;  ou  x: Mety(Isa) [= expr]; */
  private parseVariableDeclaration(): VariableDeclaration {
    const identTok = this.peek();
    const name = this.expect(TokenType.Identifier).value;
    this.expect(TokenType.Colon);
    const varType = this.parseVarType();
    const isMety = typeof varType === "object";

    let value: Expression | null = null;
    if (this.match(TokenType.Equal)) {
      value = this.parseExpression();
    } else if (!isMety) {
      const tok = this.peek();
      throw new Error(
        `"${name}" karazana tsy azo tsisy: tokony hanana soatoavina fiorenana ${pos(tok.line, tok.column)}`
      );
    }

    this.expect(TokenType.Semicolon);
    return { type: "VariableDeclaration", varType, name, value, exported: false, line: identTok.line, col: identTok.column };
  }

  /** Parse un type de variable : BaikoType, Mety(BaikoType) ou Lisitra(Type) */
  private parseVarType(): VarType {
    if (this.check(TokenType.Mety)) {
      this.advance(); // consume Mety
      this.expect(TokenType.LeftParen);
      const inner = this.parseType();
      this.expect(TokenType.RightParen);
      return { kind: "Mety", inner } as MetyType;
    }
    return this.parseType();
  }

  private parseParams(): Parameter[] {
    const params: Parameter[] = [];
    if (this.check(TokenType.RightParen)) return params;

    do {
      const name = this.expect(TokenType.Identifier).value;
      this.expect(TokenType.Colon);
      const paramType = this.parseBaseType();
      params.push({ type: "Parameter", name, paramType });
    } while (this.match(TokenType.Comma));

    return params;
  }

  /** Parse un type étendu : BaikoType ou Lisitra(Type) (récursif) */
  private parseType(): BaikoType | LisitraType {
    if (this.check(TokenType.Lisitra)) {
      this.advance();
      this.expect(TokenType.LeftParen);
      const inner = this.parseType();
      this.expect(TokenType.RightParen);
      return { kind: "Lisitra", inner } as LisitraType;
    }
    return this.parseBaseType();
  }

  /** Parse un type de base : Isa | Soratra | Marina */
  private parseBaseType(): BaikoType {
    const tok = this.peek();
    if (!TYPE_TOKENS.has(tok.type)) {
      throw new Error(`Tokony ho karazana (Isa, Soratra, Marina) fa "${tok.value}" no noraisina ${pos(tok.line, tok.column)}`);
    }
    this.advance();
    return tok.value as BaikoType;
  }

  /** raha <cond> dia ... [ankoatra dia ...] farany */
  private parseIfStatement(): IfStatement {
    this.expect(TokenType.Raha);
    const condition = this.parseExpression();
    this.expect(TokenType.Dia);
    const consequent = this.parseBlock();

    let alternate: Statement[] | null = null;
    if (this.match(TokenType.Ankoatra)) {
      this.expect(TokenType.Dia);
      alternate = this.parseBlock();
    }

    this.expect(TokenType.Farany);
    return { type: "IfStatement", condition, consequent, alternate };
  }

  /** avereno raha <cond> dia ... farany */
  private parseWhileStatement(): WhileStatement {
    this.expect(TokenType.Avereno);
    this.expect(TokenType.Raha);
    const condition = this.parseExpression();
    this.expect(TokenType.Dia);
    const body = this.parseBlock();
    this.expect(TokenType.Farany);
    return { type: "WhileStatement", condition, body };
  }

  /** mamoaka [expr] ; */
  private parseReturnStatement(): ReturnStatement {
    this.expect(TokenType.Mamoaka);
    let value: Expression | null = null;
    if (!this.check(TokenType.Semicolon)) {
      value = this.parseExpression();
    }
    this.expect(TokenType.Semicolon);
    return { type: "ReturnStatement", value };
  }

  /** asehoy <expr> ; */
  private parsePrintStatement(): PrintStatement {
    this.expect(TokenType.Asehoy);
    const value = this.parseExpression();
    this.expect(TokenType.Semicolon);
    return { type: "PrintStatement", value };
  }

  /** ampidiro "path"; */
  private parseImportStatement(): ImportStatement {
    this.expect(TokenType.Ampidiro);
    const tok = this.expect(TokenType.String);
    this.expect(TokenType.Semicolon);
    return { type: "ImportStatement", path: tok.value };
  }

  private parseExpressionStatement(): ExpressionStatement {
    const expression = this.parseExpression();
    this.expect(TokenType.Semicolon);
    return { type: "ExpressionStatement", expression };
  }

  /** Parse statements until a block-closing token is reached */
  private parseBlock(): Statement[] {
    const stmts: Statement[] = [];
    const stopAt = new Set([TokenType.Farany, TokenType.Ankoatra, TokenType.EOF]);
    while (!stopAt.has(this.peek().type)) {
      stmts.push(this.parseStatement());
    }
    return stmts;
  }

  // ---- Expressions ----

  private parseExpression(): Expression {
    return this.parseAssignment();
  }

  /** name = expr  (only when next token after identifier is =, not ==) */
  private parseAssignment(): Expression {
    if (
      this.check(TokenType.Identifier) &&
      this.tokens[this.pos + 1]?.type === TokenType.Equal
    ) {
      const name = this.advance().value;
      this.advance(); // consume =
      const value = this.parseExpression();
      return { type: "AssignmentExpression", name, value } as AssignmentExpression;
    }
    return this.parseLogicalOr();
  }

  // na (ou) — précédence la plus basse des opérateurs logiques
  private parseLogicalOr(): Expression {
    let left = this.parseLogicalAnd();
    while (this.check(TokenType.Or)) {
      const operator = this.advance().value;
      const right = this.parseLogicalAnd();
      left = { type: "BinaryExpression", operator, left, right } as BinaryExpression;
    }
    return left;
  }

  // ary (et) — précédence plus haute que na
  private parseLogicalAnd(): Expression {
    let left = this.parseComparison();
    while (this.check(TokenType.And)) {
      const operator = this.advance().value;
      const right = this.parseComparison();
      left = { type: "BinaryExpression", operator, left, right } as BinaryExpression;
    }
    return left;
  }

  private parseComparison(): Expression {
    let left = this.parseAdditive();

    const ops = new Set([
      TokenType.EqualEqual, TokenType.BangEqual,
      TokenType.Less,       TokenType.LessEqual,
      TokenType.Greater,    TokenType.GreaterEqual,
    ]);

    while (ops.has(this.peek().type)) {
      const operator = this.advance().value;
      const right = this.parseAdditive();
      const node: BinaryExpression = { type: "BinaryExpression", operator, left, right };
      left = node;
    }

    return left;
  }

  private parseAdditive(): Expression {
    let left = this.parseMultiplicative();

    while (this.check(TokenType.Plus) || this.check(TokenType.Minus)) {
      const operator = this.advance().value;
      const right = this.parseMultiplicative();
      const node: BinaryExpression = { type: "BinaryExpression", operator, left, right };
      left = node;
    }

    return left;
  }

  private parseMultiplicative(): Expression {
    let left = this.parseUnary();

    while (this.check(TokenType.Star) || this.check(TokenType.Slash)) {
      const operator = this.advance().value;
      const right = this.parseUnary();
      const node: BinaryExpression = { type: "BinaryExpression", operator, left, right };
      left = node;
    }

    return left;
  }

  private parseUnary(): Expression {
    if (this.check(TokenType.Miandry)) {
      this.advance();
      const value = this.parseUnary();
      return { type: "AwaitExpression", value } as AwaitExpression;
    }
    if (this.check(TokenType.Not)) {
      this.advance();
      const operand = this.parseUnary();
      return { type: "UnaryExpression", operator: "tsy", operand } as UnaryExpression;
    }
    if (this.check(TokenType.Minus)) {
      const operator = this.advance().value;
      const right = this.parsePrimary();
      return { type: "BinaryExpression", operator, left: { type: "NumericLiteral", value: 0 }, right };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expression {
    const tok = this.peek();

    if (tok.type === TokenType.Number) {
      this.advance();
      return { type: "NumericLiteral", value: parseFloat(tok.value) } as NumericLiteral;
    }

    if (tok.type === TokenType.String) {
      this.advance();
      return { type: "StringLiteral", value: tok.value } as StringLiteral;
    }

    if (tok.type === TokenType.LeftBracket) {
      this.advance();
      const elements: Expression[] = [];
      if (!this.check(TokenType.RightBracket)) {
        do {
          elements.push(this.parseExpression());
        } while (this.match(TokenType.Comma));
      }
      this.expect(TokenType.RightBracket);
      return this.parsePostfix({ type: "ListLiteral", elements } as ListLiteral, tok);
    }

    if (tok.type === TokenType.Identifier) {
      this.advance();
      // Regular call expression: name(args)
      if (this.match(TokenType.LeftParen)) {
        const args = this.parseArgs();
        this.expect(TokenType.RightParen);
        return { type: "CallExpression", callee: tok.value, args } as CallExpression;
      }
      return this.parsePostfix({ type: "Identifier", name: tok.value } as Identifier, tok);
    }

    if (tok.type === TokenType.True || tok.type === TokenType.False) {
      this.advance();
      return { type: "BooleanLiteral", value: tok.type === TokenType.True } as BooleanLiteral;
    }

    if (tok.type === TokenType.Tsisy) {
      this.advance();
      return { type: "TsisyLiteral" } as TsisyLiteral;
    }

    if (tok.type === TokenType.LeftParen) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TokenType.RightParen);
      return expr;
    }

    throw new Error(`Teny tsy andraina: "${tok.value}" ${pos(tok.line, tok.column)}`);
  }

  /** Tente de parser "IDENT [ expr ] = expr ;" → IndexAssignmentStatement ou null. */
  private tryParseIndexAssignment(): IndexAssignmentStatement | null {
    const saved = this.pos;
    const identTok = this.peek(); // IDENT token (line/col)
    const name = this.advance().value;
    this.advance(); // [
    const index = this.parseExpression();
    if (!this.match(TokenType.RightBracket)) { this.pos = saved; return null; }
    if (!this.match(TokenType.Equal)) { this.pos = saved; return null; }
    const value = this.parseExpression();
    this.expect(TokenType.Semicolon);
    return { type: "IndexAssignmentStatement", object: name, index, value, line: identTok.line, col: identTok.column } as IndexAssignmentStatement;
  }

  /** Apply postfix chain ([index], .method(args), .property) to a base expression. */
  private parsePostfix(base: Expression, refTok: Token): Expression {
    let result = base;
    while (this.check(TokenType.Dot) || this.check(TokenType.LeftBracket)) {
      if (this.match(TokenType.Dot)) {
        const nameTok = this.peek();
        if (nameTok.type === TokenType.EOF) {
          throw new Error(`Tokony ho anarana aorian'ny "." ${pos(nameTok.line, nameTok.column)}`);
        }
        const name = this.advance().value;
        if (this.match(TokenType.LeftParen)) {
          const args = this.parseArgs();
          this.expect(TokenType.RightParen);
          result = { type: "MemberCallExpression", object: result, method: name, args, line: refTok.line, col: refTok.column } as MemberCallExpression;
        } else {
          result = { type: "MemberExpression", object: result, property: name } as MemberExpression;
        }
      } else {
        this.advance(); // consume [
        const index = this.parseExpression();
        this.expect(TokenType.RightBracket);
        result = { type: "IndexExpression", object: result, index } as IndexExpression;
      }
    }
    return result;
  }

  private parseArgs(): Expression[] {
    const args: Expression[] = [];
    if (this.check(TokenType.RightParen)) return args;
    do {
      args.push(this.parseExpression());
    } while (this.match(TokenType.Comma));
    return args;
  }

  // ---- Helpers ----

  private match(...types: TokenType[]): boolean {
    for (const t of types) {
      if (this.check(t)) { this.advance(); return true; }
    }
    return false;
  }

  private expect(type: TokenType): Token {
    if (!this.check(type)) {
      const tok = this.peek();
      const expected = TOKEN_DESC[type] ?? `"${type}"`;
      const got = tok.value ? `"${tok.value}"` : "fiafaran'ny rakitra";
      throw new Error(`Nandiny ${got} fa nilaina ${expected} ${pos(tok.line, tok.column)}`);
    }
    return this.advance();
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isEOF()) this.pos++;
    return this.tokens[this.pos - 1];
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private isEOF(): boolean {
    return this.peek().type === TokenType.EOF;
  }
}
