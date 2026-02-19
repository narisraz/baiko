import {
  Program,
  Statement,
  Expression,
  FunctionDeclaration,
  VariableDeclaration,
  ImportStatement,
  MemberCallExpression,
  MemberExpression,
  AwaitExpression,
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
  ListLiteral,
  IndexExpression,
  BaikoType,
  LisitraType,
  MetyType,
  VarType,
} from "../types/ast";
import { Lexer } from "../lexer/lexer";
import { Parser } from "../parser/parser";
import { FileResolver } from "../interpreter/interpreter";

export class Generator {
  private indent: number = 0;
  private readonly resolver: FileResolver | null;
  private readonly imported = new Set<string>();

  constructor(resolver?: FileResolver) {
    this.resolver = resolver ?? null;
  }

  generate(program: Program): string {
    return program.body.map((s) => this.genStatement(s)).join("\n");
  }

  // ---- Statements ----

  private genStatement(stmt: Statement): string {
    switch (stmt.type) {
      case "FunctionDeclaration":       return this.genFunction(stmt as FunctionDeclaration);
      case "VariableDeclaration":       return this.genVarDecl(stmt as VariableDeclaration);
      case "ImportStatement":           return this.genImport(stmt as ImportStatement);
      case "IfStatement":               return this.genIf(stmt as IfStatement);
      case "WhileStatement":            return this.genWhile(stmt as WhileStatement);
      case "ReturnStatement":           return this.genReturn(stmt as ReturnStatement);
      case "PrintStatement":            return this.genPrint(stmt as PrintStatement);
      case "ExpressionStatement":       return this.pad() + this.genExpression((stmt as ExpressionStatement).expression) + ";";
      case "IndexAssignmentStatement": {
        const ia = stmt as IndexAssignmentStatement;
        return `${this.pad()}${ia.object}[${this.genExpression(ia.index)}] = ${this.genExpression(ia.value)};`;
      }
    }
  }

  private genVarDecl(node: VariableDeclaration): string {
    const typeAnnotation = this.genTypeAnnotation(node.varType);
    if (node.value === null) {
      return `${this.pad()}let /** @type {${typeAnnotation}} */ ${node.name};`;
    }
    return `${this.pad()}let /** @type {${typeAnnotation}} */ ${node.name} = ${this.genExpression(node.value)};`;
  }

  private genTypeAnnotation(varType: VarType): string {
    if (typeof varType === "string") return varType;
    const obj = varType as MetyType | LisitraType;
    if (obj.kind === "Mety") {
      const inner = (obj as MetyType).inner;
      if (typeof inner === "string") return `${inner} | null`;
      return `${this.genListInnerAnnotation(inner)} | null`;
    }
    return `Array<${this.genListInnerAnnotation((obj as LisitraType).inner)}>`;
  }

  private genListInnerAnnotation(t: BaikoType | LisitraType): string {
    if (typeof t === "string") {
      const jsMap: Record<string, string> = { Isa: "number", Soratra: "string", Marina: "boolean" };
      return jsMap[t] ?? t;
    }
    return `Array<${this.genListInnerAnnotation((t as LisitraType).inner)}>`;
  }

  private genImport(node: ImportStatement): string {
    if (this.imported.has(node.path)) return `// (${node.path} déjà importé)`;
    this.imported.add(node.path);

    // Package Node.js : émet un require()
    if (node.path.startsWith("package:")) {
      const pkgName = node.path.slice("package:".length);
      const varName = deriveVarName(pkgName);
      return `const ${varName} = require('${pkgName}');`;
    }

    if (!this.resolver) {
      return `// ampidiro "${node.path}" (tsy voafaritra — resolver tsy nomena)`;
    }
    const content = this.resolver(node.path);
    const tokens = new Lexer(content).tokenize();
    const program = new Parser(tokens).parse();

    // Collect exported names
    const exportedNames: string[] = [];
    for (const stmt of program.body) {
      if (
        (stmt.type === "FunctionDeclaration" || stmt.type === "VariableDeclaration") &&
        (stmt as FunctionDeclaration | VariableDeclaration).exported
      ) {
        exportedNames.push((stmt as FunctionDeclaration | VariableDeclaration).name);
      }
    }

    // Wrap the module in an IIFE to isolate private declarations
    this.indent++;
    const body = program.body.map((s) => this.genStatement(s)).join("\n");
    this.indent--;
    const returnLine = exportedNames.length > 0
      ? `  return { ${exportedNames.join(", ")} };`
      : "  return {};";
    const destructure = exportedNames.length > 0
      ? `const { ${exportedNames.join(", ")} } = `
      : "";

    return [
      `// --- ampidiro "${node.path}" ---`,
      `${destructure}(() => {`,
      body,
      returnLine,
      `})();`,
      `// --- farany "${node.path}" ---`,
    ].join("\n");
  }

  private genFunction(node: FunctionDeclaration): string {
    const params = node.params.map((p) => p.name).join(", ");
    const asyncKw = node.async ? "async " : "";
    const header = `${this.pad()}${asyncKw}function ${node.name}(${params}) {`;
    this.indent++;
    const body = node.body.map((s) => this.genStatement(s)).join("\n");
    this.indent--;
    return [header, body, `${this.pad()}}`].join("\n");
  }

  private genIf(node: IfStatement): string {
    const cond = this.genCondition(node.condition);
    const header = `${this.pad()}if (${cond}) {`;
    this.indent++;
    const consequent = node.consequent.map((s) => this.genStatement(s)).join("\n");
    this.indent--;

    if (node.alternate) {
      this.indent++;
      const alternate = node.alternate.map((s) => this.genStatement(s)).join("\n");
      this.indent--;
      return [header, consequent, `${this.pad()}} else {`, alternate, `${this.pad()}}`].join("\n");
    }

    return [header, consequent, `${this.pad()}}`].join("\n");
  }

  private genWhile(node: WhileStatement): string {
    const cond = this.genCondition(node.condition);
    const header = `${this.pad()}while (${cond}) {`;
    this.indent++;
    const body = node.body.map((s) => this.genStatement(s)).join("\n");
    this.indent--;
    return [header, body, `${this.pad()}}`].join("\n");
  }

  private genReturn(node: ReturnStatement): string {
    if (node.value === null) return `${this.pad()}return;`;
    return `${this.pad()}return ${this.genExpression(node.value)};`;
  }

  private genPrint(node: PrintStatement): string {
    return `${this.pad()}console.log(${this.genExpression(node.value)});`;
  }

  // ---- Expressions ----

  private genExpression(expr: Expression): string {
    switch (expr.type) {
      case "AssignmentExpression": {
        const a = expr as AssignmentExpression;
        return `${a.name} = ${this.genExpression(a.value)}`;
      }
      case "BinaryExpression": {
        const b = expr as BinaryExpression;
        const op = b.operator === "ary" ? "&&" : b.operator === "na" ? "||" : b.operator;
        return `(${this.genExpression(b.left)} ${op} ${this.genExpression(b.right)})`;
      }
      case "CallExpression": {
        const c = expr as CallExpression;
        const args = c.args.map((a) => this.genExpression(a)).join(", ");
        return `${c.callee}(${args})`;
      }
      case "MemberCallExpression": {
        const mc = expr as MemberCallExpression;
        const args = mc.args.map((a) => this.genExpression(a)).join(", ");
        return `${mc.object}.${mc.method}(${args})`;
      }
      case "MemberExpression":
        return `${(expr as MemberExpression).object}.${(expr as MemberExpression).property}`;
      case "AwaitExpression":
        return `await ${this.genExpression((expr as AwaitExpression).value)}`;
      case "Identifier":
        return (expr as Identifier).name;
      case "NumericLiteral":
        return String((expr as NumericLiteral).value);
      case "StringLiteral":
        return JSON.stringify((expr as StringLiteral).value);
      case "BooleanLiteral":
        return (expr as BooleanLiteral).value ? "true" : "false";
      case "TsisyLiteral":
        return "null";
      case "UnaryExpression":
        return `!(${this.genExpression((expr as UnaryExpression).operand)})`;
      case "ListLiteral": {
        const ll = expr as ListLiteral;
        return `[${ll.elements.map((e) => this.genExpression(e)).join(", ")}]`;
      }
      case "IndexExpression": {
        const ie = expr as IndexExpression;
        return `${this.genExpression(ie.object)}[${this.genExpression(ie.index)}]`;
      }
    }
  }

  /** Génère une condition sans double parenthèses pour if/while. */
  private genCondition(expr: Expression): string {
    if (expr.type === "BinaryExpression") {
      const b = expr as BinaryExpression;
      const op = b.operator === "ary" ? "&&" : b.operator === "na" ? "||" : b.operator;
      return `${this.genExpression(b.left)} ${op} ${this.genExpression(b.right)}`;
    }
    return this.genExpression(expr);
  }

  private pad(): string {
    return "  ".repeat(this.indent);
  }
}

function deriveVarName(pkgName: string): string {
  const base = pkgName.includes("/") ? pkgName.split("/").pop()! : pkgName;
  return base.replace(/[^a-zA-Z0-9_]/g, "_");
}
