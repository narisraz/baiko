export type NodeType =
  | "Program"
  | "FunctionDeclaration"
  | "Parameter"
  | "IfStatement"
  | "WhileStatement"
  | "ReturnStatement"
  | "PrintStatement"
  | "ExpressionStatement"
  | "AssignmentExpression"
  | "BinaryExpression"
  | "CallExpression"
  | "Identifier"
  | "NumericLiteral"
  | "StringLiteral"
  | "BooleanLiteral"
  | "UnaryExpression";

export type BaikoType = "Isa" | "Soratra" | "Marina";

export interface BaseNode {
  type: NodeType;
}

// ---- Top-level ----

export interface Program extends BaseNode {
  type: "Program";
  body: Statement[];
}

// ---- Statements ----

export type Statement =
  | FunctionDeclaration
  | IfStatement
  | WhileStatement
  | ReturnStatement
  | PrintStatement
  | ExpressionStatement;

/** asa name(params): ReturnType dia ... farany */
export interface FunctionDeclaration extends BaseNode {
  type: "FunctionDeclaration";
  name: string;
  params: Parameter[];
  returnType: BaikoType | null;
  body: Statement[];
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

// ---- Expressions ----

export type Expression =
  | AssignmentExpression
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | Identifier
  | NumericLiteral
  | StringLiteral
  | BooleanLiteral;

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
