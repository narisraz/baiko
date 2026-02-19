import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import { Interpreter, RuntimeError, FileResolver } from "../src/interpreter/interpreter";

async function run(src: string, resolver?: FileResolver): Promise<string[]> {
  const tokens = new Lexer(src).tokenize();
  const ast = new Parser(tokens).parse();
  const interpreter = new Interpreter(undefined, resolver);

  const lines: string[] = [];
  const spy = jest.spyOn(console, "log").mockImplementation((...args) => {
    lines.push(args.join(" "));
  });

  await interpreter.run(ast);
  spy.mockRestore();
  return lines;
}

async function runThrows(src: string): Promise<string> {
  await expect(run(src)).rejects.toThrow(RuntimeError);
  try { await run(src); } catch (e) { return (e as Error).message; }
  return "";
}

describe("Interpréteur — littéraux et asehoy", () => {
  test("nombre", async () => {
    expect(await run("asehoy 42;")).toEqual(["42"]);
  });

  test("chaîne", async () => {
    expect(await run('asehoy "Salama";')).toEqual(["Salama"]);
  });

  test("marina affiché en malagasy", async () => {
    expect(await run("asehoy marina;")).toEqual(["marina"]);
  });

  test("diso affiché en malagasy", async () => {
    expect(await run("asehoy diso;")).toEqual(["diso"]);
  });
});

describe("Interpréteur — variables", () => {
  test("déclaration et lecture", async () => {
    expect(await run("x: Isa = 10; asehoy x;")).toEqual(["10"]);
  });

  test("réassignation", async () => {
    expect(await run("x: Isa = 1; x = 99; asehoy x;")).toEqual(["99"]);
  });

  test("type invalide à la déclaration", async () => {
    await expect(run('x: Isa = "texte";')).rejects.toThrow("Tsy mety ny karazana");
  });

  test("variable non définie", async () => {
    await expect(run("asehoy inconnu;")).rejects.toThrow("Tsy fantatra ny");
  });

  test("déclaration Mety sans valeur → tsisy", async () => {
    expect(await run("x: Mety(Isa); asehoy x;")).toEqual(["tsisy"]);
  });

  test("déclaration Mety avec tsisy explicite → tsisy", async () => {
    expect(await run("x: Mety(Isa) = tsisy; asehoy x;")).toEqual(["tsisy"]);
  });

  test("déclaration Mety sans valeur puis réassignation", async () => {
    expect(await run("x: Mety(Isa); x = 42; asehoy x;")).toEqual(["42"]);
  });

  test("comparaison avec tsisy (Mety)", async () => {
    expect(await run("x: Mety(Isa); asehoy x == tsisy;")).toEqual(["marina"]);
  });

  test("déclaration non-Mety sans init → erreur", async () => {
    await expect(run("x: Isa;")).rejects.toThrow("karazana tsy azo tsisy");
  });

  test("déclaration non-Mety avec tsisy → erreur de type", async () => {
    await expect(run("x: Isa = tsisy;")).rejects.toThrow("Tsy mety ny karazana");
  });

  test("tsisy affiché en malagasy", async () => {
    expect(await run("asehoy tsisy;")).toEqual(["tsisy"]);
  });
});

describe("Interpréteur — tsisy strict (opérations interdites)", () => {
  test("tsisy + nombre → erreur", async () => {
    expect(await runThrows("x: Mety(Isa); asehoy x + 1;")).toMatch(/tsisy/);
  });

  test("nombre + tsisy → erreur", async () => {
    expect(await runThrows("x: Mety(Isa); asehoy 1 + x;")).toMatch(/tsisy/);
  });

  test("tsisy - nombre → erreur", async () => {
    expect(await runThrows("x: Mety(Isa); asehoy x - 1;")).toMatch(/tsisy/);
  });

  test("tsisy * nombre → erreur", async () => {
    expect(await runThrows("x: Mety(Isa); asehoy x * 2;")).toMatch(/tsisy/);
  });

  test("tsisy / nombre → erreur", async () => {
    expect(await runThrows("x: Mety(Isa); asehoy x / 2;")).toMatch(/tsisy/);
  });

  test("tsisy > nombre → erreur", async () => {
    expect(await runThrows("x: Mety(Isa); asehoy x > 0;")).toMatch(/tsisy/);
  });

  test("tsisy ary marina → erreur", async () => {
    expect(await runThrows("x: Mety(Marina); asehoy x ary marina;")).toMatch(/tsisy/);
  });

  test("tsisy na marina → erreur", async () => {
    expect(await runThrows("x: Mety(Marina); asehoy x na marina;")).toMatch(/tsisy/);
  });

  test("tsy tsisy → erreur", async () => {
    expect(await runThrows("x: Mety(Marina); asehoy tsy x;")).toMatch(/tsisy/);
  });

  test("tsisy == tsisy → autorisé", async () => {
    expect(await run("asehoy tsisy == tsisy;")).toEqual(["marina"]);
  });

  test("tsisy != 5 → autorisé", async () => {
    expect(await run("x: Mety(Isa); asehoy x != 5;")).toEqual(["marina"]);
  });
});

describe("Interpréteur — arithmétique", () => {
  test("addition", async () => {
    expect(await run("asehoy 3 + 4;")).toEqual(["7"]);
  });

  test("précédence * avant +", async () => {
    expect(await run("asehoy 2 + 3 * 4;")).toEqual(["14"]);
  });

  test("concaténation de chaînes", async () => {
    expect(await run('asehoy "Bon" + "jour";')).toEqual(["Bonjour"]);
  });

  test("division par zéro", async () => {
    await expect(run("asehoy 1 / 0;")).rejects.toThrow("Tsy azo zaraina");
  });
});

describe("Interpréteur — opérateurs logiques", () => {
  test("tsy marina → diso", async () => {
    expect(await run("asehoy tsy marina;")).toEqual(["diso"]);
  });

  test("marina ary marina → marina", async () => {
    expect(await run("asehoy marina ary marina;")).toEqual(["marina"]);
  });

  test("marina ary diso → diso", async () => {
    expect(await run("asehoy marina ary diso;")).toEqual(["diso"]);
  });

  test("diso na marina → marina", async () => {
    expect(await run("asehoy diso na marina;")).toEqual(["marina"]);
  });

  test("court-circuit ary : ne lève pas d'erreur si gauche est faux", async () => {
    // Si ary n'est pas court-circuit, "inconnu" lèverait une erreur
    expect(await run("raha diso ary diso dia asehoy inconnu; farany")).toEqual([]);
  });

  test("court-circuit na : ne lève pas d'erreur si gauche est vrai", async () => {
    expect(await run("raha marina na diso dia asehoy 1; farany")).toEqual(["1"]);
  });
});

describe("Interpréteur — raha / ankoatra", () => {
  test("branche vraie", async () => {
    expect(await run('raha 1 > 0 dia asehoy "oui"; farany')).toEqual(["oui"]);
  });

  test("branche fausse avec else", async () => {
    expect(await run('raha 1 > 5 dia asehoy "oui"; ankoatra dia asehoy "non"; farany')).toEqual(["non"]);
  });

  test("condition fausse sans else : rien", async () => {
    expect(await run("raha diso dia asehoy 1; farany")).toEqual([]);
  });
});

describe("Interpréteur — avereno raha", () => {
  test("boucle 1 à 3", async () => {
    const src = `
      i: Isa = 1;
      avereno raha i <= 3 dia
        asehoy i;
        i = i + 1;
      farany
    `;
    expect(await run(src)).toEqual(["1", "2", "3"]);
  });

  test("boucle ne s'exécute pas si condition fausse", async () => {
    expect(await run("avereno raha diso dia asehoy 1; farany")).toEqual([]);
  });
});

describe("Interpréteur — fonctions", () => {
  test("fonction simple", async () => {
    const src = `
      asa ampio(a: Isa, b: Isa): Isa dia
        mamoaka a + b;
      farany
      asehoy ampio(3, 4);
    `;
    expect(await run(src)).toEqual(["7"]);
  });

  test("récursion — factorielle", async () => {
    const src = `
      asa facto(n: Isa): Isa dia
        raha n <= 1 dia
          mamoaka 1;
        farany
        mamoaka n * facto(n - 1);
      farany
      asehoy facto(5);
    `;
    expect(await run(src)).toEqual(["120"]);
  });

  test("mauvais nombre d'arguments", async () => {
    const src = `
      asa f(x: Isa): Isa dia mamoaka x; farany
      f(1, 2);
    `;
    await expect(run(src)).rejects.toThrow("mitaky tohan-teny");
  });

  test("type invalide dans les arguments", async () => {
    const src = `
      asa f(x: Isa): Isa dia mamoaka x; farany
      f("texte");
    `;
    await expect(run(src)).rejects.toThrow("Tsy mety ny karazana");
  });

  test("closure — accès au scope parent", async () => {
    const src = `
      x: Isa = 10;
      asa addX(n: Isa): Isa dia
        mamoaka n + x;
      farany
      asehoy addX(5);
    `;
    expect(await run(src)).toEqual(["15"]);
  });

  test("appel sur un non-fonction", async () => {
    await expect(run("x: Isa = 1; x(2);")).rejects.toThrow("tsy asa");
  });
});

describe("Interpréteur — andrasana / miandry (async/await)", () => {
  test("asa andrasana miverina Promise", async () => {
    const src = `
      andrasana asa greet(): Soratra dia
        mamoaka "salama";
      farany
      asehoy miandry greet();
    `;
    expect(await run(src)).toEqual(["salama"]);
  });

  test("miandry Promise.resolve natif", async () => {
    // Utilise le pkgResolver injectable pour simuler une réponse async
    const tokens = new Lexer(`
      andrasana asa fetchData(): Soratra dia
        mamoaka "data";
      farany
      asehoy miandry fetchData();
    `).tokenize();
    const ast = new Parser(tokens).parse();
    const lines: string[] = [];
    const spy = jest.spyOn(console, "log").mockImplementation((...args) => lines.push(String(args[0])));
    await new Interpreter().run(ast);
    spy.mockRestore();
    expect(lines).toEqual(["data"]);
  });
});

describe("Interpréteur — package natif", () => {
  test("package introuvable → erreur", async () => {
    await expect(run('ampidiro "package:__baiko_inexistant__";'))
      .rejects.toThrow("Tsy hita ny package");
  });

  test("appel de méthode sur module Node.js built-in (path)", async () => {
    const src = `
      ampidiro "package:path";
      asehoy path.basename("/foo/bar.txt");
    `;
    expect(await run(src)).toEqual(["bar.txt"]);
  });

  test("pkgResolver injectable (no-op Proxy)", async () => {
    const { Interpreter: Interp } = require("../src/interpreter/interpreter");
    const noop = (_: string) =>
      new Proxy({} as Record<string, unknown>, { get: () => (..._a: unknown[]) => null });
    const lines: string[] = [];
    const spy = jest.spyOn(console, "log").mockImplementation((...args) => lines.push(String(args[0])));
    const tokens = new (require("../src/lexer/lexer").Lexer)(`
      ampidiro "package:axios";
      asehoy axios.get("url");
    `).tokenize();
    const ast = new (require("../src/parser/parser").Parser)(tokens).parse();
    await new Interp(undefined, undefined, noop).run(ast);
    spy.mockRestore();
    expect(lines).toEqual(["tsisy"]);
  });
});

describe("Interpréteur — ampidiro (imports)", () => {
  const mathLib = `
    avoaka asa double(n: Isa): Isa dia
      mamoaka n * 2;
    farany
    avoaka asa carre(n: Isa): Isa dia
      mamoaka n * n;
    farany
    asa secret(): Isa dia
      mamoaka 99;
    farany
  `;

  const mockResolver: FileResolver = (p) => {
    if (p === "math.baiko") return mathLib;
    throw new Error(`Rakitra tsy misy: ${p}`);
  };

  test("importe et utilise une fonction", async () => {
    const src = `
      ampidiro "math.baiko";
      asehoy double(5);
    `;
    expect(await run(src, mockResolver)).toEqual(["10"]);
  });

  test("importe plusieurs fonctions", async () => {
    const src = `
      ampidiro "math.baiko";
      asehoy double(3);
      asehoy carre(4);
    `;
    expect(await run(src, mockResolver)).toEqual(["6", "16"]);
  });

  test("import double ignoré (guard circulaire)", async () => {
    const src = `
      ampidiro "math.baiko";
      ampidiro "math.baiko";
      asehoy double(2);
    `;
    expect(await run(src, mockResolver)).toEqual(["4"]);
  });

  test("fichier introuvable → erreur", async () => {
    await expect(run('ampidiro "inexistant.baiko";', mockResolver))
      .rejects.toThrow("Tsy azo ampidirina");
  });

  test("sans resolver → erreur", async () => {
    await expect(run('ampidiro "math.baiko";'))
      .rejects.toThrow("Tsy azo ampidirina");
  });

  test("déclaration non-avoaka reste privée", async () => {
    const src = `
      ampidiro "math.baiko";
      asehoy secret();
    `;
    await expect(run(src, mockResolver)).rejects.toThrow("Tsy fantatra");
  });

  test("avoaka variable importée", async () => {
    const libWithVar = `avoaka x: Isa = 42;`;
    const resolver: FileResolver = (p) => {
      if (p === "const.baiko") return libWithVar;
      throw new Error(`Rakitra tsy misy: ${p}`);
    };
    const src = `
      ampidiro "const.baiko";
      asehoy x;
    `;
    expect(await run(src, resolver)).toEqual(["42"]);
  });
});
