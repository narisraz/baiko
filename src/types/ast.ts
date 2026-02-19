export type NodeType =
  | "Program"
  | "FunctionDeclaration"
  | "Parameter"
  | "IfStatement"
  | "WhileStatement"
  | "ReturnStatement"
  | "PrintStatement"
  | "VariableDeclaration"
  | "ImportStatement"
  | "ExpressionStatement"
  | "IndexAssignmentStatement"
  | "AssignmentExpression"
  | "BinaryExpression"
  | "CallExpression"
  | "Identifier"
  | "NumericLiteral"
  | "StringLiteral"
  | "BooleanLiteral"
  | "TsisyLiteral"
  | "UnaryExpression"
  | "MemberCallExpression"
  | "MemberExpression"
  | "AwaitExpression"
  | "ListLiteral"
  | "IndexExpression";

export type BaikoType = "Isa" | "Soratra" | "Marina";

/** Lisitra(Type) — type liste */
export interface LisitraType {
  kind: "Lisitra";
  inner: BaikoType | LisitraType;
}

/** Mety(Type) — type optionnel (peut être tsisy) */
export interface MetyType {
  kind: "Mety";
  inner: BaikoType | LisitraType;
}

export type VarType = BaikoType | MetyType | LisitraType;

export interface BaseNode {
  type: NodeType;
  line?: number;
  col?: number;
}

// ---- Top-level ----

export interface Program extends BaseNode {
  type: "Program";
  body: Statement[];
}

// ---- Statements ----

export type Statement =
  | FunctionDeclaration
  | VariableDeclaration
  | ImportStatement
  | IfStatement
  | WhileStatement
  | ReturnStatement
  | PrintStatement
  | ExpressionStatement
  | IndexAssignmentStatement;

/** ampidiro "file.baiko"; */
export interface ImportStatement extends BaseNode {
  type: "ImportStatement";
  path: string;
}

/** x: Isa = expr; ou x: Mety(Isa) [= expr]; */
export interface VariableDeclaration extends BaseNode {
  type: "VariableDeclaration";
  varType: VarType;
  name: string;
  value: Expression | null;
  exported: boolean;
}

/** asa name(params): ReturnType dia ... farany */
export interface FunctionDeclaration extends BaseNode {
  type: "FunctionDeclaration";
  name: string;
  params: Parameter[];
  returnType: BaikoType | null;
  body: Statement[];
  exported: boolean;
  async: boolean;
}

export interface Parameter extends BaseNode {
  type: "Parameter";
  name: string;
  paramType: BaikoType;
}

/** raha <cond> dia ... [ankoatra dia ...] farany */
export interface IfStatement extends BaseNode {
  type: "IfStatement";
  condition: Expression;
  consequent: Statement[];
  alternate: Statement[] | null;
}

/** ataovy <cond> dia ... farany */
export interface WhileStatement extends BaseNode {
  type: "WhileStatement";
  condition: Expression;
  body: Statement[];
}

/** avereno <expr> */
export interface ReturnStatement extends BaseNode {
  type: "ReturnStatement";
  value: Expression | null;
}

/** asehoy <expr> */
export interface PrintStatement extends BaseNode {
  type: "PrintStatement";
  value: Expression;
}

export interface ExpressionStatement extends BaseNode {
  type: "ExpressionStatement";
  expression: Expression;
}

/** x[index] = expr; */
export interface IndexAssignmentStatement extends BaseNode {
  type: "IndexAssignmentStatement";
  object: string;
  index: Expression;
  value: Expression;
}

// ---- Expressions ----

export type Expression =
  | AssignmentExpression
  | BinaryExpression
  | UnaryExpression
  | AwaitExpression
  | CallExpression
  | MemberCallExpression
  | MemberExpression
  | Identifier
  | NumericLiteral
  | StringLiteral
  | BooleanLiteral
  | TsisyLiteral
  | ListLiteral
  | IndexExpression;

/** x = expr */
export interface AssignmentExpression extends BaseNode {
  type: "AssignmentExpression";
  name: string;
  value: Expression;
}

export interface BinaryExpression extends BaseNode {
  type: "BinaryExpression";
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression extends BaseNode {
  type: "UnaryExpression";
  operator: "tsy";
  operand: Expression;
}

/** name(args) */
export interface CallExpression extends BaseNode {
  type: "CallExpression";
  callee: string;
  args: Expression[];
}

export interface Identifier extends BaseNode {
  type: "Identifier";
  name: string;
}

export interface NumericLiteral extends BaseNode {
  type: "NumericLiteral";
  value: number;
}

export interface StringLiteral extends BaseNode {
  type: "StringLiteral";
  value: string;
}

export interface BooleanLiteral extends BaseNode {
  type: "BooleanLiteral";
  value: boolean;
}

export interface TsisyLiteral extends BaseNode {
  type: "TsisyLiteral";
}

/** miandry expr — attendre une promesse */
export interface AwaitExpression extends BaseNode {
  type: "AwaitExpression";
  value: Expression;
}

/** pkg.method(args) — appel de méthode sur un objet natif */
export interface MemberCallExpression extends BaseNode {
  type: "MemberCallExpression";
  object: string;
  method: string;
  args: Expression[];
}

/** pkg.property — accès de propriété sur un objet natif */
export interface MemberExpression extends BaseNode {
  type: "MemberExpression";
  object: string;
  property: string;
}

/** [expr, expr, ...] — littéral liste */
export interface ListLiteral extends BaseNode {
  type: "ListLiteral";
  elements: Expression[];
}

/** expr[index] — accès par index */
export interface IndexExpression extends BaseNode {
  type: "IndexExpression";
  object: Expression;
  index: Expression;
}
