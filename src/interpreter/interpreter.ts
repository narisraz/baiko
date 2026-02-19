import {
  Program,
  Statement,
  Expression,
  VariableDeclaration,
  FunctionDeclaration,
  ImportStatement,
  IfStatement,
  WhileStatement,
  ReturnStatement,
  PrintStatement,
  ExpressionStatement,
  AssignmentExpression,
  BinaryExpression,
  UnaryExpression,
  CallExpression,
  Identifier,
  NumericLiteral,
  StringLiteral,
  BooleanLiteral,
  Parameter,
  BaikoType,
  MetyType,
  VarType,
} from "../types/ast";
import { Lexer } from "../lexer/lexer";
import { Parser } from "../parser/parser";

export type FileResolver = (path: string) => string;

// ---- Valeurs runtime ----

export type BaikoValue = number | string | boolean | null | BaikoCallable;

export interface BaikoCallable {
  kind: "function";
  name: string;
  params: Parameter[];
  body: Statement[];
  closure: Environment;
}

// ---- Signal de retour (déroule la pile d'appel) ----

class ReturnSignal {
  constructor(public readonly value: BaikoValue) {}
}

// ---- Environnement (scope) ----

export class Environment {
  private store = new Map<string, BaikoValue>();

  constructor(private readonly parent: Environment | null = null) {}

  get(name: string): BaikoValue {
    if (this.store.has(name)) return this.store.get(name)!;
    if (this.parent) return this.parent.get(name);
    throw new RuntimeError(`Tsy fantatra ny "${name}" — ilaina ny fanambarana azy aloha`);
  }

  define(name: string, value: BaikoValue): void {
    this.store.set(name, value);
  }

  assign(name: string, value: BaikoValue): void {
    if (this.store.has(name)) { this.store.set(name, value); return; }
    if (this.parent) { this.parent.assign(name, value); return; }
    throw new RuntimeError(`Tsy azo ovaina ny "${name}" — tsy mbola nofaritana`);
  }
}

// ---- Erreur runtime ----

export class RuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeError";
  }
}

// ---- Interpréteur ----

export class Interpreter {
  private global = new Environment();
  private readonly printFn: (s: string) => void;
  private readonly resolver: FileResolver;
  private readonly imported = new Set<string>();

  constructor(printFn?: (s: string) => void, resolver?: FileResolver) {
    this.printFn = printFn ?? ((s) => console.log(s));
    this.resolver = resolver ?? (() => {
      throw new RuntimeError("Tsy azo ampidirina ny rakitra ato amin'ity toerana ity");
    });
  }

  run(program: Program): void {
    for (const stmt of program.body) {
      this.execStmt(stmt, this.global);
    }
  }

  // ---- Statements ----

  private execStmt(stmt: Statement, env: Environment): ReturnSignal | void {
    switch (stmt.type) {
      case "VariableDeclaration":  return this.execVarDecl(stmt as VariableDeclaration, env);
      case "FunctionDeclaration":  return this.execFuncDecl(stmt as FunctionDeclaration, env);
      case "ImportStatement":      return this.execImport(stmt as ImportStatement, env);
      case "IfStatement":          return this.execIf(stmt as IfStatement, env);
      case "WhileStatement":       return this.execWhile(stmt as WhileStatement, env);
      case "ReturnStatement":      return this.execReturn(stmt as ReturnStatement, env);
      case "PrintStatement":       return this.execPrint(stmt as PrintStatement, env);
      case "ExpressionStatement":  this.execExpr((stmt as ExpressionStatement).expression, env); return;
    }
  }

  private execBlock(stmts: Statement[], env: Environment): ReturnSignal | void {
    for (const stmt of stmts) {
      const signal = this.execStmt(stmt, env);
      if (signal instanceof ReturnSignal) return signal;
    }
  }

  private execImport(node: ImportStatement, env: Environment): void {
    if (this.imported.has(node.path)) return; // déjà importé ou import circulaire
    this.imported.add(node.path);
    let content: string;
    try {
      content = this.resolver(node.path);
    } catch (e) {
      throw new RuntimeError(`Tsy azo ampidirina ny "${node.path}": ${(e as Error).message}`);
    }
    const tokens = new Lexer(content).tokenize();
    const program = new Parser(tokens).parse();
    for (const stmt of program.body) {
      this.execStmt(stmt, env);
    }
  }

  private execVarDecl(node: VariableDeclaration, env: Environment): void {
    if (node.value === null) {
      // Parser enforces this only happens for Mety types
      env.define(node.name, null);
      return;
    }
    const value = this.execExpr(node.value, env);
    this.checkType(value, node.varType, node.name);
    env.define(node.name, value);
  }

  private execFuncDecl(node: FunctionDeclaration, env: Environment): void {
    env.define(node.name, {
      kind: "function",
      name: node.name,
      params: node.params,
      body: node.body,
      closure: env,
    });
  }

  private execIf(node: IfStatement, env: Environment): ReturnSignal | void {
    if (this.isTruthy(this.execExpr(node.condition, env))) {
      return this.execBlock(node.consequent, new Environment(env));
    } else if (node.alternate) {
      return this.execBlock(node.alternate, new Environment(env));
    }
  }

  private execWhile(node: WhileStatement, env: Environment): ReturnSignal | void {
    while (this.isTruthy(this.execExpr(node.condition, env))) {
      const signal = this.execBlock(node.body, new Environment(env));
      if (signal instanceof ReturnSignal) return signal;
    }
  }

  private execReturn(node: ReturnStatement, env: Environment): ReturnSignal {
    const value = node.value ? this.execExpr(node.value, env) : null;
    return new ReturnSignal(value);
  }

  private execPrint(node: PrintStatement, env: Environment): void {
    this.printFn(this.stringify(this.execExpr(node.value, env)));
  }

  // ---- Expressions ----

  private execExpr(expr: Expression, env: Environment): BaikoValue {
    switch (expr.type) {
      case "NumericLiteral":       return (expr as NumericLiteral).value;
      case "StringLiteral":        return (expr as StringLiteral).value;
      case "BooleanLiteral":       return (expr as BooleanLiteral).value;
      case "TsisyLiteral":         return null;
      case "Identifier":           return env.get((expr as Identifier).name);
      case "AssignmentExpression": return this.execAssign(expr as AssignmentExpression, env);
      case "BinaryExpression":     return this.execBinary(expr as BinaryExpression, env);
      case "UnaryExpression": {
        const operandVal = this.execExpr((expr as UnaryExpression).operand, env);
        this.noTsisy(operandVal, "tsy");
        return !this.isTruthy(operandVal);
      }
      case "CallExpression":       return this.execCall(expr as CallExpression, env);
    }
  }

  private execAssign(node: AssignmentExpression, env: Environment): BaikoValue {
    const value = this.execExpr(node.value, env);
    env.assign(node.name, value);
    return value;
  }

  private execBinary(node: BinaryExpression, env: Environment): BaikoValue {
    // Court-circuit pour les opérateurs logiques — tsisy interdit dans les deux branches
    if (node.operator === "ary") {
      const left = this.execExpr(node.left, env);
      this.noTsisy(left, "ary");
      if (!this.isTruthy(left)) return false;
      const right = this.execExpr(node.right, env);
      this.noTsisy(right, "ary");
      return this.isTruthy(right);
    }
    if (node.operator === "na") {
      const left = this.execExpr(node.left, env);
      this.noTsisy(left, "na");
      if (this.isTruthy(left)) return true;
      const right = this.execExpr(node.right, env);
      this.noTsisy(right, "na");
      return this.isTruthy(right);
    }

    const left  = this.execExpr(node.left, env);
    const right = this.execExpr(node.right, env);

    // == et != sont les seuls opérateurs autorisés avec tsisy
    if (node.operator !== "==" && node.operator !== "!=") {
      this.noTsisy(left,  node.operator);
      this.noTsisy(right, node.operator);
    }

    switch (node.operator) {
      case "+":
        if (typeof left === "number" && typeof right === "number") return left + right;
        if (typeof left === "string" || typeof right === "string") return String(left) + String(right);
        throw new RuntimeError(`Tsy azo ampiasaina ny "+" eo amin'ny ${this.typeOf(left)} sy ${this.typeOf(right)}`);
      case "-":  return this.numOp(left, right, "-",  (a, b) => a - b);
      case "*":  return this.numOp(left, right, "*",  (a, b) => a * b);
      case "/":
        if (right === 0) throw new RuntimeError('Tsy azo zaraina amin\'ny aotra (0)');
        return this.numOp(left, right, "/", (a, b) => a / b);
      case "==": return left === right;
      case "!=": return left !== right;
      case "<":  return this.numOp(left, right, "<",  (a, b) => a < b);
      case "<=": return this.numOp(left, right, "<=", (a, b) => a <= b);
      case ">":  return this.numOp(left, right, ">",  (a, b) => a > b);
      case ">=": return this.numOp(left, right, ">=", (a, b) => a >= b);
      default:   throw new RuntimeError(`Mpanao tsy fantatra: "${node.operator}"`);
    }
  }

  private execCall(node: CallExpression, env: Environment): BaikoValue {
    const callee = env.get(node.callee);
    if (!callee || typeof callee !== "object" || (callee as BaikoCallable).kind !== "function") {
      throw new RuntimeError(`"${node.callee}" tsy asa — ${this.typeOf(callee)} no noraisina`);
    }
    const fn = callee as BaikoCallable;

    if (node.args.length !== fn.params.length) {
      throw new RuntimeError(
        `"${fn.name}" mitaky tohan-teny ${fn.params.length} fa ${node.args.length} no nomena`
      );
    }

    const fnEnv = new Environment(fn.closure);
    for (let i = 0; i < fn.params.length; i++) {
      const value = this.execExpr(node.args[i], env);
      this.checkType(value, fn.params[i].paramType, fn.params[i].name);
      fnEnv.define(fn.params[i].name, value);
    }

    const signal = this.execBlock(fn.body, fnEnv);
    return signal instanceof ReturnSignal ? signal.value : null;
  }

  // ---- Utilitaires ----

  private noTsisy(value: BaikoValue, op: string): void {
    if (value === null) {
      throw new RuntimeError(`Tsy azo ampiasaina ny "tsisy" amin'ny "${op}"`);
    }
  }

  private numOp(
    left: BaikoValue,
    right: BaikoValue,
    op: string,
    fn: (a: number, b: number) => BaikoValue
  ): BaikoValue {
    if (typeof left !== "number" || typeof right !== "number") {
      throw new RuntimeError(
        `"${op}" mitaky isa fa noraisina ${this.typeOf(left)} sy ${this.typeOf(right)}`
      );
    }
    return fn(left, right);
  }

  private checkType(value: BaikoValue, expected: VarType, name: string): void {
    if (typeof expected === "object" && (expected as MetyType).kind === "Mety") {
      if (value === null) return; // tsisy is valid for Mety
      this.checkBaseType(value, (expected as MetyType).inner, name);
    } else {
      if (value === null) {
        throw new RuntimeError(
          `Tsy mety ny karazana ho an'ny "${name}": niriny ${expected as BaikoType} fa tsisy no noraisina`
        );
      }
      this.checkBaseType(value, expected as BaikoType, name);
    }
  }

  private checkBaseType(value: BaikoValue, expected: BaikoType, name: string): void {
    const jsType: Record<BaikoType, string> = { Isa: "number", Soratra: "string", Marina: "boolean" };
    if (this.typeOf(value) !== jsType[expected]) {
      throw new RuntimeError(
        `Tsy mety ny karazana ho an'ny "${name}": niriny ${expected} fa ${this.typeOf(value)} no noraisina`
      );
    }
  }

  private typeOf(value: BaikoValue): string {
    if (value === null) return "null";
    if (typeof value === "object") return "function";
    return typeof value;
  }

  private isTruthy(value: BaikoValue): boolean {
    if (value === null || value === false) return false;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") return value.length > 0;
    return true;
  }

  private stringify(value: BaikoValue): string {
    if (value === null) return "tsisy";
    if (value === true)  return "marina";
    if (value === false) return "diso";
    if (typeof value === "object") return `<asa ${(value as BaikoCallable).name}>`;
    return String(value);
  }
}
