import { Lexer, TokenType } from "../src/lexer/lexer";

function tokenize(src: string) {
  return new Lexer(src).tokenize();
}

function types(src: string) {
  return tokenize(src).map((t) => t.type);
}

function values(src: string) {
  return tokenize(src).map((t) => t.value);
}

describe("Lexer — littéraux", () => {
  test("nombre entier", () => {
    const [tok] = tokenize("42");
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe("42");
  });

  test("nombre décimal", () => {
    const [tok] = tokenize("3.14");
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe("3.14");
  });

  test("chaîne de caractères", () => {
    const [tok] = tokenize('"Salama"');
    expect(tok.type).toBe(TokenType.String);
    expect(tok.value).toBe("Salama");
  });

  test("chaîne avec échappement", () => {
    const [tok] = tokenize('"a\\nb"');
    expect(tok.value).toBe("a\nb");
  });

  test("booléen marina", () => {
    const [tok] = tokenize("marina");
    expect(tok.type).toBe(TokenType.True);
  });

  test("booléen diso", () => {
    const [tok] = tokenize("diso");
    expect(tok.type).toBe(TokenType.False);
  });
});

describe("Lexer — mots-clés", () => {
  const cases: [string, TokenType][] = [
    ["asa",      TokenType.Asa],
    ["raha",     TokenType.Raha],
    ["ankoatra", TokenType.Ankoatra],
    ["avereno",  TokenType.Avereno],
    ["mamoaka",  TokenType.Mamoaka],
    ["dia",      TokenType.Dia],
    ["farany",   TokenType.Farany],
    ["asehoy",   TokenType.Asehoy],
    ["ary",      TokenType.And],
    ["na",       TokenType.Or],
    ["tsy",      TokenType.Not],
    ["Isa",      TokenType.Isa],
    ["Soratra",  TokenType.Soratra],
    ["Marina",   TokenType.Marina],
  ];

  test.each(cases)('"%s" → %s', (src, expected) => {
    const [tok] = tokenize(src);
    expect(tok.type).toBe(expected);
  });
});

describe("Lexer — opérateurs", () => {
  test("opérateurs arithmétiques", () => {
    expect(types("+ - * /")).toEqual([
      TokenType.Plus, TokenType.Minus, TokenType.Star, TokenType.Slash, TokenType.EOF,
    ]);
  });

  test("opérateurs de comparaison", () => {
    expect(types("== != < <= > >=")).toEqual([
      TokenType.EqualEqual, TokenType.BangEqual,
      TokenType.Less, TokenType.LessEqual,
      TokenType.Greater, TokenType.GreaterEqual,
      TokenType.EOF,
    ]);
  });

  test("assignation =", () => {
    const [tok] = tokenize("=");
    expect(tok.type).toBe(TokenType.Equal);
  });
});

describe("Lexer — commentaires et espaces", () => {
  test("ignore les commentaires #", () => {
    expect(types("# ceci est un commentaire\n42")).toEqual([
      TokenType.Number, TokenType.EOF,
    ]);
  });

  test("ignore les espaces et sauts de ligne", () => {
    expect(types("  42  \n  ")).toEqual([TokenType.Number, TokenType.EOF]);
  });
});

describe("Lexer — identifiant", () => {
  test("identifiant simple", () => {
    const [tok] = tokenize("kaonty");
    expect(tok.type).toBe(TokenType.Identifier);
    expect(tok.value).toBe("kaonty");
  });

  test("identifiant avec underscore", () => {
    const [tok] = tokenize("tsy_voky");
    expect(tok.type).toBe(TokenType.Identifier);
    expect(tok.value).toBe("tsy_voky");
  });
});

describe("Lexer — erreurs", () => {
  test("caractère inconnu", () => {
    expect(() => tokenize("@")).toThrow("Unexpected character");
  });

  test("chaîne non fermée", () => {
    expect(() => tokenize('"ouverte')).toThrow("Unterminated string");
  });
});
