import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import {
  Program,
  FunctionDeclaration,
  VariableDeclaration,
  IfStatement,
  WhileStatement,
  ReturnStatement,
  PrintStatement,
  ExpressionStatement,
  AssignmentExpression,
  BinaryExpression,
  UnaryExpression,
  CallExpression,
  NumericLiteral,
  StringLiteral,
  BooleanLiteral,
  Identifier,
  MetyType,
} from "../src/types/ast";

function parse(src: string): Program {
  const tokens = new Lexer(src).tokenize();
  return new Parser(tokens).parse();
}

function first(src: string) {
  return parse(src).body[0];
}

function expr(src: string) {
  return (first(src) as ExpressionStatement).expression;
}

describe("Parser — littéraux", () => {
  test("nombre", () => {
    const node = expr("42;") as NumericLiteral;
    expect(node.type).toBe("NumericLiteral");
    expect(node.value).toBe(42);
  });

  test("chaîne", () => {
    const node = expr('"Salama";') as StringLiteral;
    expect(node.type).toBe("StringLiteral");
    expect(node.value).toBe("Salama");
  });

  test("marina → BooleanLiteral true", () => {
    const node = expr("marina;") as BooleanLiteral;
    expect(node.type).toBe("BooleanLiteral");
    expect(node.value).toBe(true);
  });

  test("diso → BooleanLiteral false", () => {
    const node = expr("diso;") as BooleanLiteral;
    expect(node.type).toBe("BooleanLiteral");
    expect(node.value).toBe(false);
  });

  test("identifiant", () => {
    const node = expr("x;") as Identifier;
    expect(node.type).toBe("Identifier");
    expect(node.name).toBe("x");
  });

  test("tsisy", () => {
    const node = expr("tsisy;");
    expect(node.type).toBe("TsisyLiteral");
  });
});

describe("Parser — expressions arithmétiques", () => {
  test("addition", () => {
    const node = expr("1 + 2;") as BinaryExpression;
    expect(node.type).toBe("BinaryExpression");
    expect(node.operator).toBe("+");
    expect((node.left as NumericLiteral).value).toBe(1);
    expect((node.right as NumericLiteral).value).toBe(2);
  });

  test("précédence * avant +", () => {
    const node = expr("1 + 2 * 3;") as BinaryExpression;
    expect(node.operator).toBe("+");
    expect((node.right as BinaryExpression).operator).toBe("*");
  });

  test("parenthèses", () => {
    const node = expr("(1 + 2) * 3;") as BinaryExpression;
    expect(node.operator).toBe("*");
    expect((node.left as BinaryExpression).operator).toBe("+");
  });
});

describe("Parser — expressions logiques", () => {
  test("tsy (négation)", () => {
    const node = expr("tsy marina;") as UnaryExpression;
    expect(node.type).toBe("UnaryExpression");
    expect(node.operator).toBe("tsy");
    expect((node.operand as BooleanLiteral).value).toBe(true);
  });

  test("ary (et)", () => {
    const node = expr("a ary b;") as BinaryExpression;
    expect(node.operator).toBe("ary");
  });

  test("na (ou)", () => {
    const node = expr("a na b;") as BinaryExpression;
    expect(node.operator).toBe("na");
  });

  test("précédence : ary avant na", () => {
    // a na b ary c  →  a na (b ary c)
    const node = expr("a na b ary c;") as BinaryExpression;
    expect(node.operator).toBe("na");
    expect((node.right as BinaryExpression).operator).toBe("ary");
  });
});

describe("Parser — déclaration de variable typée", () => {
  test("x: Isa = 5", () => {
    const node = first("x: Isa = 5;") as VariableDeclaration;
    expect(node.type).toBe("VariableDeclaration");
    expect(node.varType).toBe("Isa");
    expect(node.name).toBe("x");
    expect((node.value as NumericLiteral).value).toBe(5);
  });

  test("nom: Soratra = chaîne", () => {
    const node = first('nom: Soratra = "Rakoto";') as VariableDeclaration;
    expect(node.varType).toBe("Soratra");
    expect(node.name).toBe("nom");
    expect((node.value as StringLiteral).value).toBe("Rakoto");
  });

  test("voky: Marina = marina", () => {
    const node = first("voky: Marina = marina;") as VariableDeclaration;
    expect(node.varType).toBe("Marina");
    expect((node.value as BooleanLiteral).value).toBe(true);
  });

  test("x: Isa sans initialisation → erreur d'analyse", () => {
    expect(() => parse("x: Isa;")).toThrow("karazana tsy azo tsisy");
  });

  test("x: Isa = tsisy → TsisyLiteral (parse ok, erreur à l'interprétation)", () => {
    const node = first("x: Isa = tsisy;") as VariableDeclaration;
    expect(node.value?.type).toBe("TsisyLiteral");
  });

  test("x: Mety(Isa) sans init → value null", () => {
    const node = first("x: Mety(Isa);") as VariableDeclaration;
    expect((node.varType as MetyType).kind).toBe("Mety");
    expect((node.varType as MetyType).inner).toBe("Isa");
    expect(node.value).toBeNull();
  });

  test("x: Mety(Soratra) = valeur → ok", () => {
    const node = first('x: Mety(Soratra) = "Salama";') as VariableDeclaration;
    expect((node.varType as MetyType).kind).toBe("Mety");
    expect((node.varType as MetyType).inner).toBe("Soratra");
    expect((node.value as StringLiteral).value).toBe("Salama");
  });

  test("x: Mety(Marina) = tsisy → TsisyLiteral", () => {
    const node = first("x: Mety(Marina) = tsisy;") as VariableDeclaration;
    expect((node.varType as MetyType).kind).toBe("Mety");
    expect(node.value?.type).toBe("TsisyLiteral");
  });
});

describe("Parser — assignation", () => {
  test("assignation simple", () => {
    const node = expr("x = 5;") as AssignmentExpression;
    expect(node.type).toBe("AssignmentExpression");
    expect(node.name).toBe("x");
    expect((node.value as NumericLiteral).value).toBe(5);
  });
});

describe("Parser — appel de fonction", () => {
  test("sans arguments", () => {
    const node = expr("f();") as CallExpression;
    expect(node.type).toBe("CallExpression");
    expect(node.callee).toBe("f");
    expect(node.args).toHaveLength(0);
  });

  test("avec arguments", () => {
    const node = expr("ampio(1, 2);") as CallExpression;
    expect(node.callee).toBe("ampio");
    expect(node.args).toHaveLength(2);
    expect((node.args[0] as NumericLiteral).value).toBe(1);
    expect((node.args[1] as NumericLiteral).value).toBe(2);
  });
});

describe("Parser — asehoy", () => {
  test("print simple", () => {
    const node = first('asehoy "Salama";') as PrintStatement;
    expect(node.type).toBe("PrintStatement");
    expect((node.value as StringLiteral).value).toBe("Salama");
  });
});

describe("Parser — raha / ankoatra", () => {
  test("if sans else", () => {
    const node = first("raha x > 0 dia asehoy x; farany") as IfStatement;
    expect(node.type).toBe("IfStatement");
    expect(node.alternate).toBeNull();
    expect(node.consequent).toHaveLength(1);
  });

  test("if avec else", () => {
    const node = first(
      "raha x > 0 dia asehoy x; ankoatra dia asehoy 0; farany"
    ) as IfStatement;
    expect(node.alternate).not.toBeNull();
    expect(node.alternate).toHaveLength(1);
  });
});

describe("Parser — avereno raha", () => {
  test("while basique", () => {
    const node = first("avereno raha x > 0 dia asehoy x; farany") as WhileStatement;
    expect(node.type).toBe("WhileStatement");
    expect(node.body).toHaveLength(1);
  });
});

describe("Parser — asa / mamoaka", () => {
  test("déclaration de fonction", () => {
    const node = first(
      "asa ampio(a: Isa, b: Isa): Isa dia mamoaka a + b; farany"
    ) as FunctionDeclaration;
    expect(node.type).toBe("FunctionDeclaration");
    expect(node.name).toBe("ampio");
    expect(node.params).toHaveLength(2);
    expect(node.params[0].name).toBe("a");
    expect(node.params[0].paramType).toBe("Isa");
    expect(node.returnType).toBe("Isa");
    expect(node.body).toHaveLength(1);
  });

  test("mamoaka", () => {
    const node = first(
      "asa f(): Isa dia mamoaka 1; farany"
    ) as FunctionDeclaration;
    const ret = node.body[0] as ReturnStatement;
    expect(ret.type).toBe("ReturnStatement");
    expect((ret.value as NumericLiteral).value).toBe(1);
  });

  test("fonction sans type de retour", () => {
    const node = first("asa f() dia mamoaka; farany") as FunctionDeclaration;
    expect(node.returnType).toBeNull();
    const ret = node.body[0] as ReturnStatement;
    expect(ret.value).toBeNull();
  });
});

describe("Parser — ampidiro", () => {
  test("import simple", () => {
    const node = first('ampidiro "utils.baiko";') as any;
    expect(node.type).toBe("ImportStatement");
    expect(node.path).toBe("utils.baiko");
  });
});

describe("Parser — appel de méthode natif", () => {
  test("asehoy pkg.method(arg)", () => {
    const node = first('asehoy axios.get("url");') as any;
    expect(node.type).toBe("PrintStatement");
    const mc = node.value;
    expect(mc.type).toBe("MemberCallExpression");
    expect(mc.object).toBe("axios");
    expect(mc.method).toBe("get");
    expect(mc.args).toHaveLength(1);
  });

  test("x: Soratra = pkg.method()", () => {
    const node = first('x: Soratra = fs.readFileSync("f");') as any;
    expect(node.type).toBe("VariableDeclaration");
    expect(node.value.type).toBe("MemberCallExpression");
  });
});

describe("Parser — avoaka", () => {
  test("avoaka asa → exported: true", () => {
    const node = first("avoaka asa f(n: Isa): Isa dia mamoaka n; farany") as any;
    expect(node.type).toBe("FunctionDeclaration");
    expect(node.name).toBe("f");
    expect(node.exported).toBe(true);
  });

  test("asa sans avoaka → exported: false", () => {
    const node = first("asa f(n: Isa): Isa dia mamoaka n; farany") as any;
    expect(node.exported).toBe(false);
  });

  test("avoaka variable → exported: true", () => {
    const node = first("avoaka x: Isa = 5;") as any;
    expect(node.type).toBe("VariableDeclaration");
    expect(node.name).toBe("x");
    expect(node.exported).toBe(true);
  });

  test("variable sans avoaka → exported: false", () => {
    const node = first("x: Isa = 5;") as any;
    expect(node.exported).toBe(false);
  });
});

describe("Parser — erreurs", () => {
  test("point-virgule manquant", () => {
    expect(() => parse("42")).toThrow();
  });

  test("farany manquant", () => {
    expect(() => parse("raha x dia asehoy x;")).toThrow();
  });

  test("type inconnu dans les paramètres", () => {
    expect(() => parse("asa f(x: Inconnu) dia farany")).toThrow("Tokony ho karazana");
  });
});
