"use strict";
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const { checkBaiko } = require("./baiko-check.js");

// ---- Documentation des mots-clés ----

const KEYWORD_DOCS = {
  ampidiro:      { label: "ampidiro",      kind: vscode.CompletionItemKind.Keyword,  doc: "Ampidiro ny rakitra (import)" },
  avoaka:        { label: "avoaka",        kind: vscode.CompletionItemKind.Keyword,  doc: "Avoaka — mampiseho ny fanambarana (export)" },
  andrasana:     { label: "andrasana",     kind: vscode.CompletionItemKind.Keyword,  doc: "Andrasana — asa async (async function)" },
  miandry:       { label: "miandry",       kind: vscode.CompletionItemKind.Keyword,  doc: "Miandry — miandry ny vokatra async (await)" },
  asa:           { label: "asa",           kind: vscode.CompletionItemKind.Keyword,  doc: "Fanambarana asa (function)" },
  raha:          { label: "raha",          kind: vscode.CompletionItemKind.Keyword,  doc: "Fehezanteny raha (if)" },
  ankoatra:      { label: "ankoatra",      kind: vscode.CompletionItemKind.Keyword,  doc: "Sampana hafa (else)" },
  "avereno raha":{ label: "avereno raha",  kind: vscode.CompletionItemKind.Keyword,  doc: "Fitodiavana (while)" },
  mamoaka:       { label: "mamoaka",       kind: vscode.CompletionItemKind.Keyword,  doc: "Avereno soatoavina (return)" },
  dia:           { label: "dia",           kind: vscode.CompletionItemKind.Keyword,  doc: "Fanombohana ny bloka (then/do)" },
  farany:        { label: "farany",        kind: vscode.CompletionItemKind.Keyword,  doc: "Famaranana ny bloka (end)" },
  asehoy:        { label: "asehoy",        kind: vscode.CompletionItemKind.Function, doc: "Asehoy ny soatoavina (print)" },
  ary:           { label: "ary",           kind: vscode.CompletionItemKind.Operator, doc: "Ary — mpiara-miasa samy marina (and)" },
  na:            { label: "na",            kind: vscode.CompletionItemKind.Operator, doc: "Na — iray amindroa marina (or)" },
  tsy:           { label: "tsy",           kind: vscode.CompletionItemKind.Operator, doc: "Tsy — mifanohitra (not)" },
  marina:        { label: "marina",        kind: vscode.CompletionItemKind.Constant, doc: "Soatoavina marina (true)" },
  diso:          { label: "diso",          kind: vscode.CompletionItemKind.Constant, doc: "Soatoavina diso (false)" },
  tsisy:         { label: "tsisy",         kind: vscode.CompletionItemKind.Constant, doc: "Soatoavina tsisy (rien / non initialisé)" },
  Isa:           { label: "Isa",           kind: vscode.CompletionItemKind.Class,    doc: "Karazana isa (number)" },
  Soratra:       { label: "Soratra",       kind: vscode.CompletionItemKind.Class,    doc: "Karazana soratra (string)" },
  Marina:        { label: "Marina",        kind: vscode.CompletionItemKind.Class,    doc: "Karazana boolean (boolean)" },
  Mety:          { label: "Mety",          kind: vscode.CompletionItemKind.Class,    doc: "Karazana azo tsisy — Mety(Type)" },
  Lisitra:       { label: "Lisitra",       kind: vscode.CompletionItemKind.Class,    doc: "Karazana lisitra — Lisitra(Type)" },
};

// ---- Scan du document : fonctions et variables ----

function scanDocument(document) {
  const text = document.getText();
  const functions = new Map();
  const variables = new Map();

  // asa nomAsa(a: Isa, b: Soratra): Isa
  const fnRe = /\basa\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*(?::\s*(Isa|Soratra|Marina))?/g;
  let m;
  while ((m = fnRe.exec(text)) !== null) {
    functions.set(m[1], { params: m[2].trim(), returnType: m[3] || null });
  }

  // nom: Type = ...  ou  nom: Mety(Type) = ...  ou  nom: Lisitra(Type) = ...
  const varRe = /\b([a-zA-Z_]\w*)\s*:\s*(?:Mety\s*\(\s*)?(Isa|Soratra|Marina)\b/g;
  while ((m = varRe.exec(text)) !== null) {
    if (!KEYWORD_DOCS[m[1]]) variables.set(m[1], m[2]);
  }
  const lisitraRe = /\b([a-zA-Z_]\w*)\s*:\s*(Lisitra\s*\((?:[^()]*|\([^()]*\))*\))/g;
  while ((m = lisitraRe.exec(text)) !== null) {
    if (!KEYWORD_DOCS[m[1]]) variables.set(m[1], m[2].replace(/\s+/g, ""));
  }

  return { functions, variables };
}

// ---- Accès natif : extraction de membres pour l'autocomplétion ----

/** Extrait tous les membres (méthodes et propriétés) uniques d'un fichier .d.ts. */
function extractMembersFromDts(dtsPath) {
  const byName = new Map(); // name → { kind, signature }
  try {
    const content = fs.readFileSync(dtsPath, "utf-8");
    const lines = content.split("\n");
    const memberRe = /^\s+(?:readonly\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\??\s*[(<:]/;
    const skipKw = /^(type|interface|class|export|import|declare|namespace|enum|const|let|var|abstract|static|public|private|protected|new|constructor)\s/;

    for (const line of lines) {
      const trimmed = line.trimStart();
      if (!trimmed || trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
      if (line === trimmed) continue; // déclaration top-level, pas un membre
      if (skipKw.test(trimmed)) continue;
      const m = memberRe.exec(line);
      if (!m) continue;
      const name = m[1];
      const isMethod = /^\s+(?:readonly\s+)?[a-zA-Z_$][a-zA-Z0-9_$]*\??\s*[(<]/.test(line);
      const existing = byName.get(name);
      if (!existing) {
        byName.set(name, {
          kind: isMethod ? vscode.CompletionItemKind.Method : vscode.CompletionItemKind.Property,
          signature: trimmed,
        });
      } else if (isMethod && existing.kind !== vscode.CompletionItemKind.Method) {
        // Priorité aux déclarations callable sur les propriétés string-literal (ex: pow: '^')
        byName.set(name, { kind: vscode.CompletionItemKind.Method, signature: trimmed });
      }
    }
  } catch (_) {}
  return [...byName.entries()].map(([name, { kind, signature }]) => ({ name, kind, signature }));
}

/** Liste les paquets npm installés dans node_modules (remonte l'arborescence). */
function getInstalledPackages(searchDir) {
  const packages = new Set();
  let dir = searchDir;
  for (let i = 0; i < 8; i++) {
    const nmDir = path.join(dir, "node_modules");
    if (fs.existsSync(nmDir)) {
      try {
        for (const entry of fs.readdirSync(nmDir)) {
          if (entry.startsWith(".") || entry.startsWith("_")) continue;
          if (entry === "@types") continue;
          if (entry.startsWith("@")) {
            try {
              for (const pkg of fs.readdirSync(path.join(nmDir, entry))) {
                packages.add(`${entry}/${pkg}`);
              }
            } catch (_) {}
          } else {
            packages.add(entry);
          }
        }
      } catch (_) {}
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return [...packages].sort();
}

// ---- CompletionItemProvider ----

function buildCompletions(document, position) {
  if (position) {
    const lineText = document.lineAt(position.line).text;
    const beforeCursor = lineText.slice(0, position.character);

    // Autocomplétion du nom de paquet : ampidiro "package:<partial>
    const pkgPrefixMatch = beforeCursor.match(/^\s*ampidiro\s+"package:([^"]*)$/);
    if (pkgPrefixMatch) {
      const partial = pkgPrefixMatch[1];
      const partialStart = position.character - partial.length;
      // Étendue du remplacement : jusqu'au prochain " ou fin de ligne
      let endChar = position.character;
      while (endChar < lineText.length && lineText[endChar] !== '"') endChar++;
      const replaceRange = new vscode.Range(position.line, partialStart, position.line, endChar);

      return getInstalledPackages(path.dirname(document.uri.fsPath))
        .filter((pkg) => pkg.toLowerCase().startsWith(partial.toLowerCase()))
        .map((pkg) => {
          const item = new vscode.CompletionItem(pkg, vscode.CompletionItemKind.Module);
          item.range = replaceRange;
          item.detail = "paokaty npm";
          item.documentation = new vscode.MarkdownString(`\`ampidiro "package:${pkg}"\``);
          return item;
        });
    }

    // Autocomplétion native : obj. → membres du .d.ts
    const dotMatch = beforeCursor.match(/([a-zA-Z_]\w*)\.(\w*)$/);
    if (dotMatch) {
      const pkgName = getPackageForIdent(document, dotMatch[1]);
      if (pkgName) {
        const dtsPath = resolveDtsPath(path.dirname(document.uri.fsPath), pkgName);
        if (dtsPath) {
          return extractMembersFromDts(dtsPath).map(({ name, kind, signature }) => {
            const item = new vscode.CompletionItem(name, kind);
            item.detail = pkgName;
            item.documentation = new vscode.MarkdownString().appendCodeblock(signature, "typescript");
            if (kind === vscode.CompletionItemKind.Method) {
              item.insertText = new vscode.SnippetString(`${name}($0)`);
            }
            return item;
          });
        }
      }
    }
  }

  const items = [];

  // Mots-clés, types, booléens
  for (const meta of Object.values(KEYWORD_DOCS)) {
    const item = new vscode.CompletionItem(meta.label, meta.kind);
    item.documentation = new vscode.MarkdownString(meta.doc);
    item.detail = "Baiko";
    items.push(item);
  }

  // Snippets pour les structures de contrôle
  const snippets = [
    {
      label: "asa … dia … farany",
      insert: new vscode.SnippetString("asa ${1:anarana}(${2:a}: ${3|Isa,Soratra,Marina|}): ${4|Isa,Soratra,Marina|} dia\n\t${0}\nfarany"),
      doc: "Fanambarana asa (function)",
    },
    {
      label: "raha … dia … farany",
      insert: new vscode.SnippetString("raha ${1:fepetra} dia\n\t${0}\nfarany"),
      doc: "Fehezanteny raha (if)",
    },
    {
      label: "raha … ankoatra … farany",
      insert: new vscode.SnippetString("raha ${1:fepetra} dia\n\t${2}\nankoatra dia\n\t${0}\nfarany"),
      doc: "Fehezanteny raha / ankoatra (if / else)",
    },
    {
      label: "avereno raha … dia … farany",
      insert: new vscode.SnippetString("avereno raha ${1:fepetra} dia\n\t${0}\nfarany"),
      doc: "Fitodiavana (while)",
    },
  ];

  for (const s of snippets) {
    const item = new vscode.CompletionItem(s.label, vscode.CompletionItemKind.Snippet);
    item.insertText = s.insert;
    item.documentation = new vscode.MarkdownString(s.doc);
    item.detail = "Baiko snippet";
    items.push(item);
  }

  // Variables et fonctions du fichier courant
  const { functions, variables } = scanDocument(document);

  for (const [name, info] of functions) {
    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
    const ret = info.returnType ? `: ${info.returnType}` : "";
    item.detail = `asa ${name}(${info.params})${ret}`;
    item.documentation = new vscode.MarkdownString("**Asa** voafaritra ao amin'ity rakitra ity");
    item.insertText = new vscode.SnippetString(`${name}($0)`);
    items.push(item);
  }

  for (const [name, type] of variables) {
    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
    item.detail = `${name}: ${type}`;
    item.documentation = new vscode.MarkdownString(`**Variable** karazana \`${type}\``);
    items.push(item);
  }

  // Paquets installés : déjà importés (haute priorité) + auto-import pour les autres
  const docText = document.getText();
  const alreadyImported = new Set();
  const importRe = /^\s*ampidiro\s+"package:([^"]+)"/gm;
  let importMatch;
  while ((importMatch = importRe.exec(docText)) !== null) {
    alreadyImported.add(deriveVarName(importMatch[1]));
  }

  // Position d'insertion : après le dernier ampidiro existant, sinon ligne 0
  let insertLine = 0;
  for (let i = 0; i < document.lineCount; i++) {
    if (document.lineAt(i).text.trimStart().startsWith("ampidiro")) insertLine = i + 1;
  }
  const insertPos = new vscode.Position(insertLine, 0);

  for (const pkg of getInstalledPackages(path.dirname(document.uri.fsPath))) {
    const varName = deriveVarName(pkg);
    const imported = alreadyImported.has(varName);
    const item = new vscode.CompletionItem(varName, vscode.CompletionItemKind.Module);
    item.detail = imported ? `package:${pkg}` : `package:${pkg}  ✦ auto-import`;
    item.documentation = new vscode.MarkdownString(
      imported ? `Paokaty \`${pkg}\` nampidirina` : `Hampidiraina \`ampidiro "package:${pkg}";\``
    );
    if (!imported) {
      item.sortText = `z_${varName}`; // après les symboles locaux
      item.additionalTextEdits = [
        vscode.TextEdit.insert(insertPos, `ampidiro "package:${pkg}";\n`),
      ];
    }
    items.push(item);
  }

  return items;
}

// ---- HoverProvider ----

function buildHover(document, position) {
  const range = document.getWordRangeAtPosition(position, /[a-zA-Z_]\w*/);
  if (!range) return null;

  const word = document.getText(range);

  // Accès natif : obj.member → afficher la signature TypeScript
  if (!KEYWORD_DOCS[word]) {
    const ctx = getMemberContext(document, position);
    if (ctx) {
      const { objName, memberName, pkgName } = ctx;
      const workspaceDir = path.dirname(document.uri.fsPath);
      const dtsPath = resolveDtsPath(workspaceDir, pkgName);
      if (dtsPath && memberName) {
        const found = findMemberInDts(dtsPath, memberName);
        if (found) {
          const md = new vscode.MarkdownString();
          md.appendCodeblock(found.signature, "typescript");
          md.appendMarkdown(`_\`${pkgName}\`_`);
          return new vscode.Hover(md, range);
        }
      }
      const label = memberName ? `${objName}.${memberName}` : objName;
      return new vscode.Hover(
        new vscode.MarkdownString(`**\`${label}\`** — paokaty \`${pkgName}\``),
        range
      );
    }
  }

  const { functions, variables } = scanDocument(document);

  if (KEYWORD_DOCS[word]) {
    const meta = KEYWORD_DOCS[word];
    return new vscode.Hover(
      new vscode.MarkdownString(`**\`${word}\`** — ${meta.doc}`),
      range
    );
  }

  if (functions.has(word)) {
    const info = functions.get(word);
    const ret = info.returnType ? `: ${info.returnType}` : "";
    return new vscode.Hover(
      new vscode.MarkdownString(`**asa** \`${word}(${info.params})${ret}\``),
      range
    );
  }

  if (variables.has(word)) {
    return new vscode.Hover(
      new vscode.MarkdownString(`**variable** \`${word}: ${variables.get(word)}\``),
      range
    );
  }

  return null;
}

// ---- SignatureHelpProvider ----

function buildSignatureHelp(document, position) {
  const { functions } = scanDocument(document);

  const lineText = document.lineAt(position.line).text.slice(0, position.character);
  const callMatch = lineText.match(/\b([a-zA-Z_]\w*)\s*\([^)]*$/);
  if (!callMatch) return null;

  const fnName = callMatch[1];
  if (!functions.has(fnName)) return null;

  const info = functions.get(fnName);
  const params = info.params ? info.params.split(",").map((p) => p.trim()) : [];
  const ret = info.returnType ? `: ${info.returnType}` : "";

  const sig = new vscode.SignatureInformation(`${fnName}(${info.params})${ret}`);
  sig.parameters = params.map((p) => new vscode.ParameterInformation(p));

  const help = new vscode.SignatureHelp();
  help.signatures = [sig];
  help.activeSignature = 0;

  const argsText = lineText.slice(lineText.lastIndexOf("(") + 1);
  help.activeParameter = Math.min(
    (argsText.match(/,/g) || []).length,
    Math.max(0, params.length - 1)
  );

  return help;
}

// ---- DefinitionProvider ----

/** Retourne la Location de `word` dans le fichier à `filePath`, ou null. */
function findDefinitionInFileText(filePath, text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const uri = vscode.Uri.file(filePath);

  const fnRe = new RegExp(`\\basa\\s+(${escaped})\\s*\\(`, "g");
  const fnMatch = fnRe.exec(text);
  if (fnMatch) {
    const before = text.slice(0, fnMatch.index);
    const line = (before.match(/\n/g) || []).length;
    const col  = fnMatch.index - before.lastIndexOf("\n") - 1;
    return new vscode.Location(uri, new vscode.Position(line, col));
  }

  const varRe = new RegExp(`\\b(${escaped})\\s*:\\s*(?:(?:Mety|Lisitra)\\s*\\(|(?:Isa|Soratra|Marina)\\b)`, "g");
  const varMatch = varRe.exec(text);
  if (varMatch) {
    const before = text.slice(0, varMatch.index);
    const line = (before.match(/\n/g) || []).length;
    const col  = varMatch.index - before.lastIndexOf("\n") - 1;
    return new vscode.Location(uri, new vscode.Position(line, col));
  }

  return null;
}

/** Retourne les chemins absolus de tous les fichiers importés par `document`. */
function getImportedPaths(document) {
  const dir  = path.dirname(document.uri.fsPath);
  const text = document.getText();
  const re   = /^\s*ampidiro\s+"([^"]+)"/gm;
  const paths = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const resolved = path.resolve(dir, m[1]);
    if (fs.existsSync(resolved)) paths.push(resolved);
  }
  return paths;
}

// ---- Accès natif : helpers ----

function deriveVarName(pkgName) {
  const base = pkgName.includes("/") ? pkgName.split("/").pop() : pkgName;
  return base.replace(/[^a-zA-Z0-9_]/g, "_");
}

/** Retourne le nom de package npm associé à un identifiant Baiko, ou null. */
function getPackageForIdent(document, identName) {
  const text = document.getText();
  const re = /^\s*ampidiro\s+"package:([^"]+)"/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (deriveVarName(m[1]) === identName) return m[1];
  }
  return null;
}

/** Résout le chemin vers le fichier .d.ts principal d'un paquet npm. */
function resolveDtsPath(searchDir, pkgName) {
  const dirs = [];
  let dir = searchDir;
  for (let i = 0; i < 8; i++) {
    dirs.push(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  function tryTypes(name) {
    try {
      const pkgJsonPath = require.resolve(name + "/package.json", { paths: dirs });
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
      const pkgDir = path.dirname(pkgJsonPath);
      const typesField = pkgJson.types || pkgJson.typings;
      if (typesField) {
        const resolved = path.resolve(pkgDir, typesField);
        if (fs.existsSync(resolved)) return resolved;
      }
      const indexDts = path.join(pkgDir, "index.d.ts");
      if (fs.existsSync(indexDts)) return indexDts;
    } catch (_) {}
    return null;
  }

  const atTypesName = pkgName.startsWith("@")
    ? pkgName.slice(1).replace("/", "__")
    : pkgName;
  return tryTypes(pkgName) || tryTypes("@types/" + atTypesName) || null;
}

/** Cherche un membre dans un fichier .d.ts ; retourne { line, col, signature } ou null. */
function findMemberInDts(dtsPath, memberName) {
  try {
    const content = fs.readFileSync(dtsPath, "utf-8");
    const lines = content.split("\n");
    const esc = memberName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Callable declaration: name( or name<T (generic function)
    const fnRe   = new RegExp(`\\b${esc}\\s*[(<]`);
    // Property declaration fallback: name:
    const propRe = new RegExp(`\\b${esc}\\s*:`);
    const nameRe = new RegExp(`\\b${esc}\\b`);

    let propMatch = null;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trimStart();
      // Skip comment lines
      if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
      if (fnRe.test(lines[i])) {
        const col = lines[i].search(nameRe);
        return { line: i, col: Math.max(0, col), signature: lines[i].trim() };
      }
      if (propMatch === null && propRe.test(lines[i])) {
        const col = lines[i].search(nameRe);
        propMatch = { line: i, col: Math.max(0, col), signature: lines[i].trim() };
      }
    }
    return propMatch;
  } catch (_) {}
  return null;
}

/**
 * Si le curseur est sur un accès natif (obj.member ou obj.),
 * retourne { objName, memberName, pkgName } ou null.
 */
function getMemberContext(document, position) {
  const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_]\w*/);
  if (!wordRange) return null;
  const word = document.getText(wordRange);
  const lineText = document.lineAt(position.line).text;

  // Cursor sur le membre : `mathjs.sqrt`
  const beforeWord = lineText.slice(0, wordRange.start.character);
  const objMatch = beforeWord.match(/([a-zA-Z_]\w*)\.$/);
  if (objMatch) {
    const pkgName = getPackageForIdent(document, objMatch[1]);
    if (pkgName) return { objName: objMatch[1], memberName: word, pkgName };
  }

  // Cursor sur l'objet : `mathjs`.sqrt
  const afterWord = lineText[wordRange.end.character];
  if (afterWord === ".") {
    const pkgName = getPackageForIdent(document, word);
    if (pkgName) {
      const afterDot = lineText.slice(wordRange.end.character + 1);
      const memberMatch = afterDot.match(/^([a-zA-Z_]\w*)/);
      return { objName: word, memberName: memberMatch ? memberMatch[1] : null, pkgName };
    }
  }

  return null;
}

function buildDefinition(document, position) {
  // ---- Import : clic sur le chemin "fichier.baiko" ----
  const importRange = document.getWordRangeAtPosition(position, /"[^"]*"/);
  if (importRange) {
    const lineText = document.lineAt(position.line).text;
    const importMatch = lineText.match(/^\s*ampidiro\s+"([^"]+)"/);
    if (importMatch) {
      const importPath = importMatch[1];
      const resolved = path.resolve(path.dirname(document.uri.fsPath), importPath);
      if (fs.existsSync(resolved)) {
        const targetUri = vscode.Uri.file(resolved);
        return new vscode.Location(targetUri, new vscode.Position(0, 0));
      }
    }
  }

  // ---- Fonctions et variables ----
  const range = document.getWordRangeAtPosition(position, /[a-zA-Z_]\w*/);
  if (!range) return null;

  const word = document.getText(range);
  if (KEYWORD_DOCS[word]) return null; // mots-clés : pas de définition

  // ---- Accès natif : obj.member → naviguer vers le .d.ts ----
  const ctx = getMemberContext(document, position);
  if (ctx) {
    const { memberName, pkgName } = ctx;
    const workspaceDir = path.dirname(document.uri.fsPath);
    const dtsPath = resolveDtsPath(workspaceDir, pkgName);
    if (dtsPath) {
      if (memberName) {
        const found = findMemberInDts(dtsPath, memberName);
        const line = found ? found.line : 0;
        const col  = found ? found.col  : 0;
        return new vscode.Location(vscode.Uri.file(dtsPath), new vscode.Position(line, col));
      }
      return new vscode.Location(vscode.Uri.file(dtsPath), new vscode.Position(0, 0));
    }
    return null;
  }

  // Cherche d'abord dans le fichier courant
  const loc = findDefinitionInFileText(document.uri.fsPath, document.getText(), word);
  if (loc) return loc;

  // Cherche ensuite dans les fichiers importés
  for (const filePath of getImportedPaths(document)) {
    try {
      const text = fs.readFileSync(filePath, "utf-8");
      const imported = findDefinitionInFileText(filePath, text, word);
      if (imported) return imported;
    } catch (_) { /* fichier illisible */ }
  }

  return null;
}

// ---- Diagnostics ----

// Valeurs Baiko qui apparaissent dans les messages d'erreur mais ne correspondent
// pas à une position utile dans le source (ex: "tsisy" dans "tsisy amin'ny >")
const BAIKO_VALUE_KEYWORDS = new Set(["tsisy", "marina", "diso"]);

function findTokenInDocument(document, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Word boundaries pour les identifiants, recherche littérale pour les opérateurs
  const isIdent = /^[a-zA-Z_]\w*$/.test(name);
  const re = isIdent ? new RegExp(`\\b${escaped}\\b`) : new RegExp(escaped);
  for (let i = 0; i < document.lineCount; i++) {
    const col = document.lineAt(i).text.search(re);
    if (col !== -1) return { line: i, col };
  }
  return null;
}

/**
 * Vérifie statiquement que les accès natifs (obj.member) font référence
 * à des membres qui existent dans le .d.ts du paquet.
 * Retourne des erreurs au format { message, line, col } (1-indexés).
 */
function checkNativeAccess(document, workspaceDir) {
  const errors = [];
  const text = document.getText();
  const lines = text.split("\n");

  // Collecte les paquets importés et leurs membres connus
  const packages = new Map(); // varName → { pkgName, members: Set<string> }
  const importRe = /^\s*ampidiro\s+"package:([^"]+)"/gm;
  let m;
  while ((m = importRe.exec(text)) !== null) {
    const pkgName = m[1];
    const varName = deriveVarName(pkgName);
    const dtsPath = resolveDtsPath(workspaceDir, pkgName);
    if (dtsPath) {
      const members = new Set(extractMembersFromDts(dtsPath).map((mem) => mem.name));
      packages.set(varName, { pkgName, members });
    }
  }

  if (packages.size === 0) return errors;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (line.trimStart().startsWith("#")) continue; // commentaire Baiko

    for (const [varName, { pkgName, members }] of packages) {
      const esc = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const accessRe = new RegExp(`\\b${esc}\\.([a-zA-Z_$][a-zA-Z0-9_$]*)`, "g");
      let match;
      while ((match = accessRe.exec(line)) !== null) {
        const memberName = match[1];
        // Ignore les accès dans les chaînes (heuristique : compter les guillemets avant)
        const before = line.slice(0, match.index);
        if ((before.match(/"/g) || []).length % 2 !== 0) continue;
        if (!members.has(memberName)) {
          const col = match.index + varName.length + 1; // 0-indexé, pointe sur memberName
          errors.push({
            message: `"${memberName}" tsy hita ao amin'ny paokaty "${pkgName}"`,
            line: lineIdx + 1,
            col: col + 1, // 1-indexé
          });
        }
      }
    }
  }

  return errors;
}

async function computeDiagnostics(document, collection) {
  if (document.languageId !== "baiko") return;

  const dir = path.dirname(document.uri.fsPath);
  const resolver = (importPath) => fs.readFileSync(path.resolve(dir, importPath), "utf-8");
  const errors = [
    ...(await checkBaiko(document.getText(), resolver)),
    ...checkNativeAccess(document, dir),
  ];
  const diags = errors.map((err) => {
    let range;

    if (err.line !== null && err.col !== null) {
      const lineIdx = err.line - 1;
      const colIdx  = err.col  - 1;
      const lineText = document.lineAt(lineIdx).text;
      let wordEnd = colIdx;
      while (wordEnd < lineText.length && /\w/.test(lineText[wordEnd])) wordEnd++;
      range = new vscode.Range(lineIdx, colIdx, lineIdx, Math.max(colIdx + 1, wordEnd));
    } else {
      // Essaie chaque terme entre guillemets dans le message (en ignorant les
      // valeurs Baiko comme "tsisy" qui ne correspondent pas à une position utile)
      const allQuoted = [...err.message.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      const candidates = allQuoted.filter((t) => !BAIKO_VALUE_KEYWORDS.has(t));
      let found = false;
      for (const term of candidates) {
        const pos = findTokenInDocument(document, term);
        if (pos) {
          range = new vscode.Range(pos.line, pos.col, pos.line, pos.col + term.length);
          found = true;
          break;
        }
      }
      if (!found) {
        range = document.lineAt(0).range;
      }
    }

    return new vscode.Diagnostic(range, err.message, vscode.DiagnosticSeverity.Error);
  });

  collection.set(document.uri, diags);
}

// ---- Activation ----

function activate(context) {
  // Providers existants
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      "baiko",
      { provideCompletionItems: (doc, pos) => buildCompletions(doc, pos) },
      ".", ":", " "
    )
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      "baiko",
      { provideHover: (doc, pos) => buildHover(doc, pos) }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerSignatureHelpProvider(
      "baiko",
      { provideSignatureHelp: (doc, pos) => buildSignatureHelp(doc, pos) },
      "(", ","
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      "baiko",
      { provideDefinition: (doc, pos) => buildDefinition(doc, pos) }
    )
  );

  // Diagnostics
  const diagnosticCollection = vscode.languages.createDiagnosticCollection("baiko");
  context.subscriptions.push(diagnosticCollection);

  let debounceTimer;
  function scheduleUpdate(document) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => computeDiagnostics(document, diagnosticCollection), 300);
  }

  // Analyse le fichier actif au démarrage
  if (vscode.window.activeTextEditor) {
    computeDiagnostics(vscode.window.activeTextEditor.document, diagnosticCollection);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => scheduleUpdate(e.document)),
    vscode.workspace.onDidOpenTextDocument((doc) => computeDiagnostics(doc, diagnosticCollection)),
    vscode.workspace.onDidCloseTextDocument((doc) => diagnosticCollection.delete(doc.uri)),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) computeDiagnostics(editor.document, diagnosticCollection);
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
