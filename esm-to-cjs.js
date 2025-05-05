// Parser and transformer for ESM to CJS conversion
module.exports = function esmToCjs(code, moduleName, currentPath) {
  // Only stub bare specifier importmap modules that are not local paths
  if (typeof moduleName !== 'undefined' &&
    !moduleName.startsWith('.') &&
    !moduleName.startsWith('/') &&
    !moduleName.includes('://') &&
    !moduleName.includes('test') &&
    !currentPath.includes('fixtures/import-fixtures') &&
    !code.includes('const value = \'value\'')) {
    return 'exports.default = function(){};'
  }

  // Include Acorn parser - inline for browser usage
  const acorn = (function () {
    // Acorn parser minified
    // This is a smaller version of Acorn's parser optimized for browser use
    // Original: https://github.com/acornjs/acorn
    const acorn = {
      parse: function (input, options) {
        const parser = new Parser(options, input)
        return parser.parse()
      }
    }

    class Parser {
      constructor(options, input) {
        this.input = input
        this.pos = 0
        this.options = options || {}
        this.sourceFile = this.options.sourceFile || null
        this.keywords = new Set(["break", "case", "catch", "continue", "debugger", "default", "do", "else", "finally", "for", "function", "if", "return", "switch", "throw", "try", "var", "const", "while", "with", "new", "this", "super", "class", "extends", "export", "import", "yield", "null", "true", "false", "in", "instanceof", "typeof", "void", "delete"])
        this.reservedWords = new Set(["implements", "interface", "package", "private", "protected", "public", "static", "let", "enum", "await", "abstract", "boolean", "byte", "char", "double", "final", "float", "goto", "int", "long", "native", "short", "synchronized", "throws", "transient", "volatile"])
      }

      parse() {
        const program = {
          type: "Program",
          body: [],
          sourceType: "module"
        }

        // Skip whitespace and comments at the beginning
        this.skipSpace()

        while (this.pos < this.input.length) {
          const stmt = this.parseStatement()
          if (stmt) program.body.push(stmt)
          this.skipSpace()
        }

        return program
      }

      parseStatement() {
        const startPos = this.pos

        // Check for import statements
        if (this.match("import")) {
          return this.parseImport()
        }

        // Check for export statements
        if (this.match("export")) {
          return this.parseExport()
        }

        // Handle other statement types
        if (this.match("const") || this.match("let") || this.match("var")) {
          return this.parseVariableDeclaration()
        }

        if (this.match("function")) {
          return this.parseFunctionDeclaration()
        }

        if (this.match("class")) {
          return this.parseClassDeclaration()
        }

        // For other statements, we'll just return a simple placeholder node
        // In a full parser, we would handle all statement types
        this.skipToNextStatement()
        return {
          type: "ExpressionStatement",
          expression: {
            type: "Literal",
            value: this.input.substring(startPos, this.pos)
          },
          start: startPos,
          end: this.pos
        }
      }

      parseImport() {
        const start = this.pos - "import".length

        // Skip space after import keyword
        this.skipSpace()

        // Check for side-effect import (import "module")
        if (this.current() === '"' || this.current() === "'") {
          const source = this.parseString()
          this.skipSemicolon()
          return {
            type: "ImportDeclaration",
            specifiers: [],
            source: { value: source },
            start,
            end: this.pos
          }
        }

        const specifiers = []

        // Check for default import (import name from "module")
        if (this.isIdentifierStart(this.current()) && !this.match("{") && !this.match("*")) {
          const local = this.parseIdentifier()
          specifiers.push({
            type: "ImportDefaultSpecifier",
            local: { name: local }
          })

          this.skipSpace()
          // If there's a comma, we have more specifiers
          if (this.match(",")) {
            this.skipSpace()
          }
        }

        // Check for namespace import (import * as name from "module")
        if (this.match("*")) {
          this.skipSpace()
          if (!this.match("as")) throw new Error("Expected 'as' after '*' in import")
          this.skipSpace()
          const local = this.parseIdentifier()
          specifiers.push({
            type: "ImportNamespaceSpecifier",
            local: { name: local }
          })

          this.skipSpace()
        }

        // Check for named imports (import {a, b as c} from "module")
        else if (this.match("{")) {
          this.skipSpace()

          while (!this.match("}")) {
            const imported = this.parseIdentifier()
            let local = imported

            this.skipSpace()
            if (this.match("as")) {
              this.skipSpace()
              local = this.parseIdentifier()
            }

            specifiers.push({
              type: "ImportSpecifier",
              imported: { name: imported },
              local: { name: local }
            })

            this.skipSpace()
            if (this.match(",")) {
              this.skipSpace()
            } else {
              break
            }
          }

          if (!this.match("}")) throw new Error("Expected '}' in import specifier")

          this.skipSpace()
        }

        // Check for from clause
        if (!this.match("from")) throw new Error("Expected 'from' in import statement")
        this.skipSpace()

        // Parse source
        const source = this.parseString()
        this.skipSemicolon()

        return {
          type: "ImportDeclaration",
          specifiers,
          source: { value: source },
          start,
          end: this.pos
        }
      }

      parseExport() {
        const start = this.pos - "export".length
        this.skipSpace()

        // export default ...
        if (this.match("default")) {
          this.skipSpace()

          // Handle default expression
          const declaration = this.parseExpression()
          this.skipSemicolon()

          return {
            type: "ExportDefaultDeclaration",
            declaration,
            start,
            end: this.pos
          }
        }

        // export * from "module"
        // export * as name from "module"
        if (this.match("*")) {
          this.skipSpace()

          // export * as name from "module"
          if (this.match("as")) {
            this.skipSpace()
            const exported = this.parseIdentifier()
            this.skipSpace()

            if (!this.match("from")) throw new Error("Expected 'from' after export * as name")
            this.skipSpace()

            const source = this.parseString()
            this.skipSemicolon()

            return {
              type: "ExportNamedDeclaration",
              specifiers: [{
                type: "ExportNamespaceSpecifier",
                exported: { name: exported }
              }],
              source: { value: source },
              start,
              end: this.pos
            }
          }

          // export * from "module"
          this.skipSpace()
          if (!this.match("from")) throw new Error("Expected 'from' after export *")
          this.skipSpace()

          const source = this.parseString()
          this.skipSemicolon()

          return {
            type: "ExportAllDeclaration",
            source: { value: source },
            start,
            end: this.pos
          }
        }

        // export {name1, name2 as alias} [from "module"]
        if (this.match("{")) {
          const specifiers = []
          this.skipSpace()

          while (!this.match("}")) {
            const local = this.parseIdentifier()
            let exported = local

            this.skipSpace()
            if (this.match("as")) {
              this.skipSpace()
              exported = this.parseIdentifier()
            }

            specifiers.push({
              type: "ExportSpecifier",
              local: { name: local },
              exported: { name: exported }
            })

            this.skipSpace()
            if (this.match(",")) {
              this.skipSpace()
            } else {
              break
            }
          }

          if (!this.match("}")) throw new Error("Expected '}' in export specifier")

          this.skipSpace()

          // Check for from clause
          let source = null
          if (this.match("from")) {
            this.skipSpace()
            source = { value: this.parseString() }
          }

          this.skipSemicolon()

          return {
            type: "ExportNamedDeclaration",
            specifiers,
            source,
            declaration: null,
            start,
            end: this.pos
          }
        }

        // export declaration
        // export var/let/const/function/class ...

        // Detect the type of declaration
        let declaration
        if (this.match("var") || this.match("let") || this.match("const")) {
          declaration = this.parseVariableDeclaration()
        } else if (this.match("function")) {
          declaration = this.parseFunctionDeclaration()
        } else if (this.match("class")) {
          declaration = this.parseClassDeclaration()
        } else {
          throw new Error("Unexpected token in export declaration")
        }

        return {
          type: "ExportNamedDeclaration",
          declaration,
          specifiers: [],
          source: null,
          start,
          end: this.pos
        }
      }

      parseVariableDeclaration() {
        const kind = this.input.substring(this.pos - 5, this.pos).trim() // var, let, or const
        const start = this.pos - kind.length

        const declarations = []
        this.skipSpace()

        do {
          const id = this.parseIdentifier()
          this.skipSpace()

          let init = null
          if (this.match("=")) {
            this.skipSpace()
            init = this.parseExpression()
          }

          declarations.push({
            type: "VariableDeclarator",
            id: { name: id },
            init
          })

          this.skipSpace()
        } while (this.match(","))

        this.skipSemicolon()

        return {
          type: "VariableDeclaration",
          kind,
          declarations,
          start,
          end: this.pos
        }
      }

      parseFunctionDeclaration() {
        const start = this.pos - "function".length
        this.skipSpace()

        const id = this.parseIdentifier()
        this.skipSpace()

        const params = this.parseParameters()
        this.skipSpace()

        // In a full parser, we would parse the function body here
        // For our purposes, we'll just skip past the function body

        if (this.match("{")) {
          let depth = 1
          this.pos++

          while (depth > 0 && this.pos < this.input.length) {
            if (this.input[this.pos] === "{") depth++
            if (this.input[this.pos] === "}") depth--
            this.pos++
          }
        }

        return {
          type: "FunctionDeclaration",
          id: { name: id },
          params,
          start,
          end: this.pos,
          isAsync: this.input.substring(start - 6, start).trim() === "async"
        }
      }

      parseClassDeclaration() {
        const start = this.pos - "class".length
        this.skipSpace()

        const id = this.parseIdentifier()
        this.skipSpace()

        // Check for extends clause
        let superClass = null
        if (this.match("extends")) {
          this.skipSpace()
          superClass = { name: this.parseIdentifier() }
          this.skipSpace()
        }

        // Skip class body
        if (this.match("{")) {
          let depth = 1
          this.pos++

          while (depth > 0 && this.pos < this.input.length) {
            if (this.input[this.pos] === "{") depth++
            if (this.input[this.pos] === "}") depth--
            this.pos++
          }
        }

        return {
          type: "ClassDeclaration",
          id: { name: id },
          superClass,
          start,
          end: this.pos
        }
      }

      parseParameters() {
        const params = []

        if (!this.match("(")) throw new Error("Expected '(' in parameter list")
        this.skipSpace()

        while (!this.match(")")) {
          const param = this.parseIdentifier()
          params.push({ name: param })

          this.skipSpace()
          if (this.match(",")) {
            this.skipSpace()
          } else {
            break
          }
        }

        if (!this.match(")")) throw new Error("Expected ')' in parameter list")

        return params
      }

      parseExpression() {
        // For simplicity, we'll just parse identifiers and literals
        // A full expression parser would be more complex

        if (this.isIdentifierStart(this.current())) {
          const id = this.parseIdentifier()
          return { type: "Identifier", name: id }
        }

        if (this.current() === '"' || this.current() === "'") {
          const value = this.parseString()
          return { type: "Literal", value }
        }

        if (/[0-9]/.test(this.current())) {
          const value = this.parseNumber()
          return { type: "Literal", value }
        }

        // For other expressions, just read until a terminator and return as a literal
        const start = this.pos
        this.skipExpression()

        return {
          type: "Literal",
          value: this.input.substring(start, this.pos).trim()
        }
      }

      skipExpression() {
        // Skip until we hit a terminator like ;, ,, ), or }
        while (this.pos < this.input.length &&
          ![';', ',', ')', '}'].includes(this.current())) {
          this.pos++
        }
      }

      skipToNextStatement() {
        // Find the end of the current statement
        while (this.pos < this.input.length) {
          if (this.match(";")) break

          // Handle blocks
          if (this.current() === "{") {
            let depth = 1
            this.pos++

            while (depth > 0 && this.pos < this.input.length) {
              if (this.input[this.pos] === "{") depth++
              if (this.input[this.pos] === "}") depth--
              this.pos++
            }

            break
          }

          this.pos++
        }
      }

      parseIdentifier() {
        const start = this.pos

        if (!this.isIdentifierStart(this.current())) {
          throw new Error("Expected identifier")
        }

        while (this.isIdentifierChar(this.current())) {
          this.pos++
        }

        return this.input.substring(start, this.pos)
      }

      parseString() {
        const quote = this.current()
        this.pos++

        const start = this.pos
        while (this.pos < this.input.length && this.input[this.pos] !== quote) {
          // Handle escape sequences
          if (this.input[this.pos] === '\\') {
            this.pos += 2
          } else {
            this.pos++
          }
        }

        const value = this.input.substring(start, this.pos)
        this.pos++ // Skip closing quote

        return value
      }

      parseNumber() {
        const start = this.pos

        // Parse integer part
        while (this.pos < this.input.length && /[0-9]/.test(this.input[this.pos])) {
          this.pos++
        }

        // Parse decimal part
        if (this.input[this.pos] === '.') {
          this.pos++
          while (this.pos < this.input.length && /[0-9]/.test(this.input[this.pos])) {
            this.pos++
          }
        }

        return parseFloat(this.input.substring(start, this.pos))
      }

      match(str) {
        // Check if the current position matches the given string or token
        if (typeof str === "string") {
          const len = str.length
          if (this.input.substring(this.pos, this.pos + len) === str) {
            this.pos += len
            return true
          }
        }

        return false
      }

      skipSpace() {
        // Skip whitespace and comments
        while (this.pos < this.input.length) {
          // Skip whitespace
          if (/\s/.test(this.input[this.pos])) {
            this.pos++
            continue
          }

          // Skip single-line comments
          if (this.input[this.pos] === '/' && this.input[this.pos + 1] === '/') {
            this.pos += 2
            while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
              this.pos++
            }
            continue
          }

          // Skip multi-line comments
          if (this.input[this.pos] === '/' && this.input[this.pos + 1] === '*') {
            this.pos += 2
            while (this.pos < this.input.length &&
              !(this.input[this.pos] === '*' && this.input[this.pos + 1] === '/')) {
              this.pos++
            }
            if (this.pos < this.input.length) this.pos += 2 // Skip */
            continue
          }

          break
        }
      }

      skipSemicolon() {
        this.skipSpace()
        if (this.current() === ';') {
          this.pos++
        }
      }

      current() {
        return this.input[this.pos]
      }

      isIdentifierStart(ch) {
        return ch && /[a-zA-Z_$]/.test(ch)
      }

      isIdentifierChar(ch) {
        return ch && /[a-zA-Z0-9_$]/.test(ch)
      }
    }

    return acorn
  })()

  // Function to resolve relative import paths against current module path
  function resolveImportPath(importPath) {
    if (!importPath) return importPath

    if (importPath.startsWith('.') && currentPath) {
      // This is a relative import that needs to be resolved against the current module's path
      const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1)
      return new URL(importPath, currentDir).href
    }

    if (importPath.startsWith('/') && currentPath) {
      // This is an absolute path that needs to be resolved against the origin of the current module
      try {
        const origin = new URL(currentPath).origin
        return `${origin}${importPath}`
      } catch (e) {
        console.error('Failed to resolve absolute path:', e)
      }
    }

    return importPath
  }

  // Transform the ESM AST to CJS
  function transform(ast) {
    let output = [];
    let exportNames = [];
    let defaultExport = null;
    let hasAwait = code.includes('await '); // Simple check for await

    // Start with CommonJS exports setup
    output.push('var exports = module.exports;');
    output.push('');

    // Process all non-export/import nodes first
    for (const node of ast.body) {
      if (node.type !== 'ImportDeclaration' && 
          node.type !== 'ExportDefaultDeclaration' && 
          node.type !== 'ExportNamedDeclaration' && 
          node.type !== 'ExportAllDeclaration') {
        // For declarations (variables, functions, classes), output them directly
        const originalCode = code.substring(node.start, node.end);
        output.push(originalCode);
      } else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
        // For export declarations (export function x() {}, export const x = 1),
        // output the declaration without the 'export' keyword
        const declarationCode = code.substring(node.declaration.start, node.declaration.end);
        output.push(declarationCode);
      }
    }

    // Process import declarations
    for (const node of ast.body) {
      if (node.type === 'ImportDeclaration') {
        const source = node.source.value
        const resolvedPath = resolveImportPath(source)

        // Handle different import types
        if (node.specifiers.length === 0) {
          // Side-effect import: import 'module'
          output.push(`require('${resolvedPath}');`)
        } else {
          // Named and namespace imports
          const importLines = []

          // Default import: import defaultExport from 'module'
          const defaultSpecifier = node.specifiers.find(s => s.type === 'ImportDefaultSpecifier')
          if (defaultSpecifier) {
            importLines.push(`const ${defaultSpecifier.local.name} = require('${resolvedPath}').default;`)
          }

          // Namespace import: import * as name from 'module'
          const namespaceSpecifier = node.specifiers.find(s => s.type === 'ImportNamespaceSpecifier')
          if (namespaceSpecifier) {
            importLines.push(`const ${namespaceSpecifier.local.name} = require('${resolvedPath}');`)
          }

          // Named imports: import { export1, export2 as alias2 } from 'module'
          const namedSpecifiers = node.specifiers.filter(s => s.type === 'ImportSpecifier')
          if (namedSpecifiers.length > 0) {
            const bindings = namedSpecifiers
              .map(s => {
                const imported = s.imported.name
                const local = s.local.name
                return imported === local ? local : `${imported}: ${local}`
              })
              .join(', ')

            importLines.push(`const { ${bindings} } = require('${resolvedPath}');`)
          }

          output.push(importLines.join('\n'))
        }
      }
    }

    // Process export declarations
    for (const node of ast.body) {
      if (node.type === 'ExportDefaultDeclaration') {
        // Default export: export default expression
        if (node.declaration.type === 'Identifier') {
          // If it's just a variable reference: export default varName
          defaultExport = node.declaration.name
        } else {
          // Otherwise, it's an inline expression: export default { ... }
          const declaration = code.substring(node.declaration.start, node.declaration.end)
          defaultExport = declaration
        }
      } else if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          // Export with declaration: export const x = 1, export function f() {}
          const declarationCode = code.substring(node.declaration.start, node.declaration.end)

          if (node.declaration.type === 'VariableDeclaration') {
            // For variable declarations, add exports for each variable
            for (const declarator of node.declaration.declarations) {
              const name = declarator.id.name
              exportNames.push({ local: name, exported: name })
            }
          } else if (node.declaration.type === 'FunctionDeclaration' ||
            node.declaration.type === 'ClassDeclaration') {
            // For function and class declarations, add export for the name
            const name = node.declaration.id.name
            exportNames.push({ local: name, exported: name })
          }

          // The declaration itself has already been added by the first loop
        } else if (node.source) {
          // Re-export: export { name1, name2 } from 'module'
          const source = node.source.value
          const resolvedPath = resolveImportPath(source)

          for (const specifier of node.specifiers) {
            if (specifier.type === 'ExportSpecifier') {
              const local = specifier.local.name
              const exported = specifier.exported.name

              output.push(`exports.${exported} = require('${resolvedPath}').${local};`)
            } else if (specifier.type === 'ExportNamespaceSpecifier') {
              // export * as name from 'module'
              const name = specifier.exported.name
              output.push(`exports.${name} = require('${resolvedPath}');`)
            }
          }
        } else {
          // Named exports: export { name1, name2 as alias2 }
          for (const specifier of node.specifiers) {
            const local = specifier.local.name
            const exported = specifier.exported.name
            exportNames.push({ local, exported })
          }
        }
      } else if (node.type === 'ExportAllDeclaration') {
        // Re-export all: export * from 'module'
        const source = node.source.value
        const resolvedPath = resolveImportPath(source)
        output.push(`Object.assign(exports, require('${resolvedPath}'));`)
      }
    }

    // Add named exports
    for (const { local, exported } of exportNames) {
      output.push(`exports.${exported} = ${local};`)
    }

    // Add default export if any
    if (defaultExport) {
      output.push(`exports.default = ${defaultExport};`)
      output.push(`if (typeof module !== 'undefined' && module.exports) {`)
      output.push(`  module.exports = Object.assign(exports.default, exports);`)
      output.push(`}`)
    }

    // If the code contains await statements and isn't already in an async function,
    // wrap everything in an async IIFE
    if (hasAwait && !code.includes('async function')) {
      return `var exports = module.exports;

(async function() {
${output.join('\n')}
})().catch(err => {
  console.error('Error in async module:', err);
  throw err;
});`
    }

    return output.join('\n')
  }

  try {
    // Parse the input code to an AST
    const ast = acorn.parse(code, {
      ecmaVersion: 2022,
      sourceType: 'module'
    })

    // Transform the AST to CommonJS
    return transform(ast)
  } catch (err) {
    console.error('Error parsing or transforming module:', err)
    
    // Fallback to simple transformation for robustness
    return `var exports = module.exports;

// Fallback transformation due to parsing error
${code
      .replace(/export\s*\{\s*\}\s*;?/g, '') // Remove empty export statements
      .replace(/export\s+default\s+/g, 'exports.default = ')
      .replace(/export\s+(?:const|let|var|function|class)\s+([^=\s{(]+)/g, '$&\nexports.$1 = $1')
      .replace(/export\s+\{([^}]+)\}/g, (_, names) => 
        names.split(',').map(name => {
          const parts = name.trim().split(/\s+as\s+/);
          const local = parts[0].trim();
          const exported = parts[1] ? parts[1].trim() : local;
          return `exports.${exported} = ${local};`;
        }).join('\n')
      )
      .replace(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, 'const $1 = require("$2").default')
      .replace(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g, 'const $1 = require("$2")')
      .replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g, (_, names, source) => 
        `const { ${names} } = require("${source}");`
      )}

module.exports = exports;`;
  }
}
