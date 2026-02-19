import {
  Program,
  Statement,
  Expression,
  FunctionDeclaration,
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
} from "../types/ast";

export class Generator {
  private indent: number = 0;

  generate(program: Program): string {
    return program.body.map((s) => this.genStatement(s)).join("\n");
  }

  // ---- Statements ----

  private genStatement(stmt: Statement): string {
    switch (stmt.type) {
      case "FunctionDeclaration":  return this.genFunction(stmt as FunctionDeclaration);
      case "IfStatement":          return this.genIf(stmt as IfStatement);
      case "WhileStatement":       return this.genWhile(stmt as WhileStatement);
      case "ReturnStatement":      return this.genReturn(stmt as ReturnStatement);
      case "PrintStatement":       return this.genPrint(stmt as PrintStatement);
      case "ExpressionStatement":  return this.pad() + this.genExpression((stmt as ExpressionStatement).expression) + ";";
    }
  }

  private genFunction(node: FunctionDeclaration): string {
    const params = node.params.map((p) => p.name).join(", ");
    const header = `${this.pad()}function ${node.name}(${params}) {`;
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
      case "Identifier":
        return (expr as Identifier).name;
      case "NumericLiteral":
        return String((expr as NumericLiteral).value);
      case "StringLiteral":
        return JSON.stringify((expr as StringLiteral).value);
      case "BooleanLiteral":
        return (expr as BooleanLiteral).value ? "true" : "false";
      case "UnaryExpression":
        return `!(${this.genExpression((expr as UnaryExpression).operand)})`;
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
