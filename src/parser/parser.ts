import { Token, TokenType } from "../lexer/lexer";
import {
  Program,
  Statement,
  Expression,
  FunctionDeclaration,
  Parameter,
  IfStatement,
  WhileStatement,
  ReturnStatement,
  PrintStatement,
  ExpressionStatement,
  AssignmentExpression,
  BinaryExpression,
  CallExpression,
  Identifier,
  NumericLiteral,
  StringLiteral,
  BooleanLiteral,
  UnaryExpression,
  BaikoType,
} from "../types/ast";

const TYPE_TOKENS = new Set([TokenType.Isa, TokenType.Soratra, TokenType.Marina]);

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
    // "avereno raha" is the while keyword (compound)
    if (this.check(TokenType.Avereno) && this.tokens[this.pos + 1]?.type === TokenType.Raha) {
      return this.parseWhileStatement();
    }
    switch (this.peek().type) {
      case TokenType.Asa:     return this.parseFunctionDeclaration();
      case TokenType.Raha:    return this.parseIfStatement();
      case TokenType.Mamoaka: return this.parseReturnStatement();
      case TokenType.Asehoy:  return this.parsePrintStatement();
      default:                return this.parseExpressionStatement();
    }
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
      returnType = this.parseType();
    }

    this.expect(TokenType.Dia);
    const body = this.parseBlock();
    this.expect(TokenType.Farany);

    return { type: "FunctionDeclaration", name, params, returnType, body };
  }

  private parseParams(): Parameter[] {
    const params: Parameter[] = [];
    if (this.check(TokenType.RightParen)) return params;

    do {
      const name = this.expect(TokenType.Identifier).value;
      this.expect(TokenType.Colon);
      const paramType = this.parseType();
      params.push({ type: "Parameter", name, paramType });
    } while (this.match(TokenType.Comma));

    return params;
  }

  private parseType(): BaikoType {
    const tok = this.peek();
    if (!TYPE_TOKENS.has(tok.type)) {
      throw new Error(`Expected type (Isa, Soratra, Marina) at ${tok.line}:${tok.column}`);
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

    if (tok.type === TokenType.Identifier) {
      this.advance();
      // Call expression: name(args)
      if (this.match(TokenType.LeftParen)) {
        const args = this.parseArgs();
        this.expect(TokenType.RightParen);
        return { type: "CallExpression", callee: tok.value, args } as CallExpression;
      }
      return { type: "Identifier", name: tok.value } as Identifier;
    }

    if (tok.type === TokenType.True || tok.type === TokenType.False) {
      this.advance();
      return { type: "BooleanLiteral", value: tok.type === TokenType.True } as BooleanLiteral;
    }

    if (tok.type === TokenType.LeftParen) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TokenType.RightParen);
      return expr;
    }

    throw new Error(`Unexpected token '${tok.value}' at ${tok.line}:${tok.column}`);
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
      throw new Error(`Expected ${type} but got '${tok.value}' at ${tok.line}:${tok.column}`);
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
