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
  AwaitExpression,
  CallExpression,
  MemberCallExpression,
  MemberExpression,
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
export type PackageResolver = (pkgName: string) => unknown;

/** Dérive le nom de variable Baiko à partir du nom de package npm.
 *  Ex: "axios" → "axios", "@org/pkg-name" → "pkg_name"
 */
function deriveVarName(pkgName: string): string {
  const base = pkgName.includes("/") ? pkgName.split("/").pop()! : pkgName;
  return base.replace(/[^a-zA-Z0-9_]/g, "_");
}

/** Objet JavaScript natif encapsulé (résultat d'un ampidiro "package:...") */
export interface BaikoNative {
  kind: "native";
  value: unknown;
}

// ---- Valeurs runtime ----

export type BaikoValue = number | string | boolean | null | BaikoCallable | BaikoNative;

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
  private readonly pkgResolver: PackageResolver;
  private readonly imported = new Set<string>();

  constructor(
    printFn?: (s: string) => void,
    resolver?: FileResolver,
    pkgResolver?: PackageResolver,
  ) {
    this.printFn = printFn ?? ((s) => console.log(s));
    this.resolver = resolver ?? (() => {
      throw new RuntimeError("Tsy azo ampidirina ny rakitra ato amin'ity toerana ity");
    });
    this.pkgResolver = pkgResolver ?? ((pkgName: string) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(pkgName) as unknown;
    });
  }

  async run(program: Program): Promise<void> {
    for (const stmt of program.body) {
      await this.execStmt(stmt, this.global);
    }
  }

  // ---- Statements ----

  private async execStmt(stmt: Statement, env: Environment): Promise<ReturnSignal | void> {
    switch (stmt.type) {
      case "VariableDeclaration":  return this.execVarDecl(stmt as VariableDeclaration, env);
      case "FunctionDeclaration":  return this.execFuncDecl(stmt as FunctionDeclaration, env);
      case "ImportStatement":      return this.execImport(stmt as ImportStatement, env);
      case "IfStatement":          return this.execIf(stmt as IfStatement, env);
      case "WhileStatement":       return this.execWhile(stmt as WhileStatement, env);
      case "ReturnStatement":      return this.execReturn(stmt as ReturnStatement, env);
      case "PrintStatement":       return this.execPrint(stmt as PrintStatement, env);
      case "ExpressionStatement":  await this.execExpr((stmt as ExpressionStatement).expression, env); return;
    }
  }

  private async execBlock(stmts: Statement[], env: Environment): Promise<ReturnSignal | void> {
    for (const stmt of stmts) {
      const signal = await this.execStmt(stmt, env);
      if (signal instanceof ReturnSignal) return signal;
    }
  }

  private async execImport(node: ImportStatement, env: Environment): Promise<void> {
    if (this.imported.has(node.path)) return;
    this.imported.add(node.path);

    // ---- Package Node.js : ampidiro "package:pkgname" ----
    if (node.path.startsWith("package:")) {
      const pkgName = node.path.slice("package:".length);
      const varName = deriveVarName(pkgName);
      let mod: unknown;
      try {
        mod = this.pkgResolver(pkgName);
      } catch (e) {
        throw new RuntimeError(`Tsy hita ny package "${pkgName}": ${(e as Error).message}`);
      }
      env.define(varName, { kind: "native", value: mod });
      return;
    }

    // ---- Fichier Baiko ----
    let content: string;
    try {
      content = this.resolver(node.path);
    } catch (e) {
      throw new RuntimeError(`Tsy azo ampidirina ny "${node.path}": ${(e as Error).message}`);
    }
    const tokens = new Lexer(content).tokenize();
    const program = new Parser(tokens).parse();

    const moduleEnv = new Environment(null);
    for (const stmt of program.body) {
      await this.execStmt(stmt, moduleEnv);
    }

    for (const stmt of program.body) {
      if (
        (stmt.type === "FunctionDeclaration" || stmt.type === "VariableDeclaration") &&
        (stmt as FunctionDeclaration | VariableDeclaration).exported
      ) {
        const name = (stmt as FunctionDeclaration | VariableDeclaration).name;
        env.define(name, moduleEnv.get(name));
      }
    }
  }

  private async execVarDecl(node: VariableDeclaration, env: Environment): Promise<void> {
    if (node.value === null) {
      env.define(node.name, null);
      return;
    }
    const value = await this.execExpr(node.value, env);
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

  private async execIf(node: IfStatement, env: Environment): Promise<ReturnSignal | void> {
    if (this.isTruthy(await this.execExpr(node.condition, env))) {
      return this.execBlock(node.consequent, new Environment(env));
    } else if (node.alternate) {
      return this.execBlock(node.alternate, new Environment(env));
    }
  }

  private async execWhile(node: WhileStatement, env: Environment): Promise<ReturnSignal | void> {
    while (this.isTruthy(await this.execExpr(node.condition, env))) {
      const signal = await this.execBlock(node.body, new Environment(env));
      if (signal instanceof ReturnSignal) return signal;
    }
  }

  private async execReturn(node: ReturnStatement, env: Environment): Promise<ReturnSignal> {
    const value = node.value ? await this.execExpr(node.value, env) : null;
    return new ReturnSignal(value);
  }

  private async execPrint(node: PrintStatement, env: Environment): Promise<void> {
    this.printFn(this.stringify(await this.execExpr(node.value, env)));
  }

  // ---- Expressions ----

  private async execExpr(expr: Expression, env: Environment): Promise<BaikoValue> {
    switch (expr.type) {
      case "NumericLiteral":       return (expr as NumericLiteral).value;
      case "StringLiteral":        return (expr as StringLiteral).value;
      case "BooleanLiteral":       return (expr as BooleanLiteral).value;
      case "TsisyLiteral":         return null;
      case "Identifier":           return env.get((expr as Identifier).name);
      case "AssignmentExpression": return this.execAssign(expr as AssignmentExpression, env);
      case "BinaryExpression":     return this.execBinary(expr as BinaryExpression, env);
      case "UnaryExpression": {
        const operandVal = await this.execExpr((expr as UnaryExpression).operand, env);
        this.noTsisy(operandVal, "tsy");
        return !this.isTruthy(operandVal);
      }
      case "AwaitExpression":      return this.execAwait(expr as AwaitExpression, env);
      case "CallExpression":       return this.execCall(expr as CallExpression, env);
      case "MemberCallExpression": return this.execMemberCall(expr as MemberCallExpression, env);
      case "MemberExpression":     return this.execMemberAccess(expr as MemberExpression, env);
    }
  }

  private async execAssign(node: AssignmentExpression, env: Environment): Promise<BaikoValue> {
    const value = await this.execExpr(node.value, env);
    env.assign(node.name, value);
    return value;
  }

  private async execBinary(node: BinaryExpression, env: Environment): Promise<BaikoValue> {
    if (node.operator === "ary") {
      const left = await this.execExpr(node.left, env);
      this.noTsisy(left, "ary");
      if (!this.isTruthy(left)) return false;
      const right = await this.execExpr(node.right, env);
      this.noTsisy(right, "ary");
      return this.isTruthy(right);
    }
    if (node.operator === "na") {
      const left = await this.execExpr(node.left, env);
      this.noTsisy(left, "na");
      if (this.isTruthy(left)) return true;
      const right = await this.execExpr(node.right, env);
      this.noTsisy(right, "na");
      return this.isTruthy(right);
    }

    const left  = await this.execExpr(node.left, env);
    const right = await this.execExpr(node.right, env);

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

  private async execCall(node: CallExpression, env: Environment): Promise<BaikoValue> {
    const callee = env.get(node.callee);

    // BaikoNative wrapping a plain JS function (e.g. default export of node-fetch)
    if (callee !== null && typeof callee === "object" && (callee as BaikoNative).kind === "native") {
      const native = (callee as BaikoNative).value;
      if (typeof native === "function") {
        const args = await Promise.all(node.args.map((a) => this.execExpr(a, env)));
        const result = (native as (...a: unknown[]) => unknown)(...args);
        return this.tobaiko(result);
      }
    }

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
      const value = await this.execExpr(node.args[i], env);
      this.checkType(value, fn.params[i].paramType, fn.params[i].name);
      fnEnv.define(fn.params[i].name, value);
    }

    const signal = await this.execBlock(fn.body, fnEnv);
    return signal instanceof ReturnSignal ? signal.value : null;
  }

  private async execMemberCall(node: MemberCallExpression, env: Environment): Promise<BaikoValue> {
    const obj = env.get(node.object);
    if (
      obj === null ||
      typeof obj !== "object" ||
      (obj as BaikoNative).kind !== "native"
    ) {
      throw new RuntimeError(
        `"${node.object}" dia tsy sehatra natif — ${this.typeOf(obj)} no noraisina`
      );
    }
    const native = (obj as BaikoNative).value as Record<string, unknown>;
    const fn = native[node.method];
    if (typeof fn !== "function") {
      throw new RuntimeError(`"${node.object}.${node.method}" tsy asa natif`);
    }
    const args = await Promise.all(node.args.map((a) => this.execExpr(a, env)));
    const result = (fn as (...a: unknown[]) => unknown).call(native, ...args);
    return this.tobaiko(result);
  }

  private async execMemberAccess(node: MemberExpression, env: Environment): Promise<BaikoValue> {
    const obj = env.get(node.object);
    if (obj === null || typeof obj !== "object" || (obj as BaikoNative).kind !== "native") {
      throw new RuntimeError(
        `"${node.object}" dia tsy sehatra natif — ${this.typeOf(obj)} no noraisina`
      );
    }
    const native = (obj as BaikoNative).value as Record<string, unknown>;
    return this.tobaiko(native[node.property]);
  }

  private async execAwait(node: AwaitExpression, env: Environment): Promise<BaikoValue> {
    const value = await this.execExpr(node.value, env);
    // Si c'est un BaikoNative wrappant une Promise, on l'attend
    if (
      value !== null &&
      typeof value === "object" &&
      (value as BaikoNative).kind === "native"
    ) {
      const inner = (value as BaikoNative).value;
      if (
        inner !== null &&
        typeof inner === "object" &&
        typeof (inner as Record<string, unknown>)["then"] === "function"
      ) {
        const resolved = await (inner as Promise<unknown>);
        return this.tobaiko(resolved);
      }
    }
    return value; // valeur non-Promise : retournée telle quelle
  }

  /** Convertit une valeur JS en BaikoValue. */
  private tobaiko(value: unknown): BaikoValue {
    if (value === null || value === undefined) return null;
    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
      return value;
    }
    return { kind: "native", value };
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
    if (this.isNative(left) || this.isNative(right)) {
      // Arithmetic with a native JS value: result is also native (type unknown).
      return { kind: "native", value: null };
    }
    if (typeof left !== "number" || typeof right !== "number") {
      throw new RuntimeError(
        `"${op}" mitaky isa fa noraisina ${this.typeOf(left)} sy ${this.typeOf(right)}`
      );
    }
    return fn(left, right);
  }

  private isNative(v: BaikoValue): boolean {
    return v !== null && typeof v === "object" && (v as BaikoNative).kind === "native";
  }

  private checkType(value: BaikoValue, expected: VarType, name: string): void {
    // Les valeurs natives passent la vérification de type (interop JS)
    if (typeof value === "object" && value !== null && (value as BaikoNative).kind === "native") return;
    if (typeof expected === "object" && (expected as MetyType).kind === "Mety") {
      if (value === null) return;
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
    if (typeof value === "object" && (value as BaikoNative).kind === "native") return "natif";
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
    if (typeof value === "object" && (value as BaikoNative).kind === "native") {
      const v = (value as BaikoNative).value;
      try { return JSON.stringify(v); } catch { return String(v); }
    }
    if (typeof value === "object") return `<asa ${(value as BaikoCallable).name}>`;
    return String(value);
  }
}
