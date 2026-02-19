"use strict";
const vscode = require("vscode");
const { checkBaiko } = require("./baiko-check.js");

// ---- Documentation des mots-clés ----

const KEYWORD_DOCS = {
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
  Isa:           { label: "Isa",           kind: vscode.CompletionItemKind.Class,    doc: "Karazana isa (number)" },
  Soratra:       { label: "Soratra",       kind: vscode.CompletionItemKind.Class,    doc: "Karazana soratra (string)" },
  Marina:        { label: "Marina",        kind: vscode.CompletionItemKind.Class,    doc: "Karazana boolean (boolean)" },
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

  // nom: Type = ...
  const varRe = /\b([a-zA-Z_]\w*)\s*:\s*(Isa|Soratra|Marina)\b/g;
  while ((m = varRe.exec(text)) !== null) {
    if (!KEYWORD_DOCS[m[1]]) {
      variables.set(m[1], m[2]);
    }
  }

  return { functions, variables };
}

// ---- CompletionItemProvider ----

function buildCompletions(document) {
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

  return items;
}

// ---- HoverProvider ----

function buildHover(document, position) {
  const range = document.getWordRangeAtPosition(position, /[a-zA-Z_]\w*/);
  if (!range) return null;

  const word = document.getText(range);
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

function buildDefinition(document, position) {
  const range = document.getWordRangeAtPosition(position, /[a-zA-Z_]\w*/);
  if (!range) return null;

  const word = document.getText(range);
  if (KEYWORD_DOCS[word]) return null; // mots-clés : pas de définition

  const text = document.getText();

  // Cherche "asa <word>("
  const fnRe = new RegExp(`\\basa\\s+(${word})\\s*\\(`, "g");
  const fnMatch = fnRe.exec(text);
  if (fnMatch) {
    const pos = document.positionAt(fnMatch.index);
    return new vscode.Location(document.uri, pos);
  }

  // Cherche "<word>: Type ="
  const varRe = new RegExp(`\\b(${word})\\s*:\\s*(Isa|Soratra|Marina)\\b`, "g");
  const varMatch = varRe.exec(text);
  if (varMatch) {
    const pos = document.positionAt(varMatch.index);
    return new vscode.Location(document.uri, pos);
  }

  return null;
}

// ---- Diagnostics ----

function findIdentInDocument(document, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`);
  for (let i = 0; i < document.lineCount; i++) {
    const col = document.lineAt(i).text.search(re);
    if (col !== -1) return { line: i, col };
  }
  return null;
}

function computeDiagnostics(document, collection) {
  if (document.languageId !== "baiko") return;

  const errors = checkBaiko(document.getText());
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
      // Essaie de localiser l'identifiant cité dans le message
      const nameMatch = err.message.match(/"([^"]+)"/);
      let found = false;
      if (nameMatch) {
        const pos = findIdentInDocument(document, nameMatch[1]);
        if (pos) {
          range = new vscode.Range(pos.line, pos.col, pos.line, pos.col + nameMatch[1].length);
          found = true;
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
      { provideCompletionItems: (doc) => buildCompletions(doc) },
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
