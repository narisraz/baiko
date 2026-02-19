# Baiko

A programming language implemented in TypeScript.

## Project Structure

```
baiko/
├── src/
│   ├── lexer/lexer.ts       # Tokenizer
│   ├── parser/parser.ts     # AST parser
│   ├── generator/generator.ts # Code generator
│   ├── types/ast.ts         # AST node types
│   └── index.ts             # CLI entrypoint
├── examples/
│   └── test.baiko           # Example source file
├── package.json
├── tsconfig.json
└── README.md
```

## Getting Started

```bash
npm install
npm run dev examples/test.baiko
```

## Build

```bash
npm run build
npm start examples/test.baiko
```

## Pipeline

```
source → Lexer → tokens → Parser → AST → Generator → output
```
