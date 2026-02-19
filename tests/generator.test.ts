import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import { Generator } from "../src/generator/generator";

function compile(src: string): string {
  const tokens = new Lexer(src).tokenize();
  const ast = new Parser(tokens).parse();
  return new Generator().generate(ast);
}

describe("Generator — littéraux", () => {
  test("nombre", () => {
    expect(compile("42;")).toBe("42;");
  });

  test("chaîne", () => {
    expect(compile('"Salama";')).toBe('"Salama";');
  });

  test("marina → true", () => {
    expect(compile("marina;")).toBe("true;");
  });

  test("diso → false", () => {
    expect(compile("diso;")).toBe("false;");
  });
});

describe("Generator — expressions", () => {
  test("addition", () => {
    expect(compile("1 + 2;")).toBe("(1 + 2);");
  });

  test("précédence : parenthèses conservées", () => {
    expect(compile("1 + 2 * 3;")).toBe("(1 + (2 * 3));");
  });

  test("assignation", () => {
    expect(compile("x = 42;")).toBe("x = 42;");
  });

  test("appel de fonction", () => {
    expect(compile("f(1, 2);")).toBe("f(1, 2);");
  });
});

describe("Generator — opérateurs logiques", () => {
  test("tsy → !", () => {
    expect(compile("tsy marina;")).toBe("!(true);");
  });

  test("ary → &&", () => {
    expect(compile("a ary b;")).toBe("(a && b);");
  });

  test("na → ||", () => {
    expect(compile("a na b;")).toBe("(a || b);");
  });
});

describe("Generator — asehoy", () => {
  test("print", () => {
    expect(compile('asehoy "Salama";')).toBe('console.log("Salama");');
  });

  test("print expression", () => {
    expect(compile("asehoy 1 + 2;")).toBe("console.log((1 + 2));");
  });
});

describe("Generator — raha / ankoatra", () => {
  test("if sans else — pas de double parenthèses", () => {
    const out = compile("raha x > 0 dia asehoy x; farany");
    expect(out).toBe(
      "if (x > 0) {\n  console.log(x);\n}"
    );
  });

  test("if avec else", () => {
    const out = compile("raha x > 0 dia asehoy x; ankoatra dia asehoy 0; farany");
    expect(out).toContain("} else {");
  });

  test("condition booléenne — pas de double parenthèses", () => {
    const out = compile("avereno raha x <= 5 dia asehoy x; farany");
    expect(out).toMatch(/^while \(x <= 5\)/);
  });
});

describe("Generator — avereno raha", () => {
  test("while basique", () => {
    const out = compile("avereno raha i > 0 dia asehoy i; farany");
    expect(out).toBe("while (i > 0) {\n  console.log(i);\n}");
  });
});

describe("Generator — asa / mamoaka", () => {
  test("fonction avec paramètres", () => {
    const out = compile("asa ampio(a: Isa, b: Isa): Isa dia mamoaka a + b; farany");
    expect(out).toBe(
      "function ampio(a, b) {\n  return (a + b);\n}"
    );
  });

  test("fonction sans paramètres", () => {
    const out = compile("asa f() dia mamoaka; farany");
    expect(out).toBe("function f() {\n  return;\n}");
  });
});

describe("Generator — indentation", () => {
  test("blocs imbriqués", () => {
    const src = `
      asa f() dia
        raha marina dia
          asehoy 1;
        farany
      farany
    `;
    const out = compile(src);
    expect(out).toBe(
      "function f() {\n  if (true) {\n    console.log(1);\n  }\n}"
    );
  });
});
