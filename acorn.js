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
    this.allowYield = options && options.allowYieldOutsideFunction || false
    this.allowAwait = options && options.allowAwaitOutsideFunction || false
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

    // Check if this is a generator function (has * after function keyword)
    const isGenerator = this.match("*")
    if (isGenerator) {
      this.skipSpace()
    }

    // Check if this is preceded by async keyword
    const functionKeywordStart = start - "function".length
    const isAsync = functionKeywordStart >= 0 &&
      this.input.substring(functionKeywordStart, start).trim() === "async"

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
      isAsync,
      isGenerator
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

    try {
      if (!this.match("(")) throw new Error("Expected '(' in parameter list")
      this.skipSpace()

      // Fast-path for empty parameter list
      if (this.match(")")) {
        return params
      }

      // Simple parameter skipping - just count parentheses depth until we reach the closing ")"
      let depth = 1  // We've already consumed the opening "("
      while (depth > 0 && this.pos < this.input.length) {
        const char = this.input[this.pos]
        if (char === "(") depth++
        if (char === ")") depth--
        this.pos++

        // Only add the closing parenthesis if we're at the right depth
        if (depth === 0 && char === ")") {
          break
        }
      }

      // Add a basic parameter placeholder
      params.push({ name: "params" })

      return params
    } catch (e) {
      // If there's an error, try a simpler approach - just find the closing parenthesis
      this.pos = this.input.indexOf(")", this.pos)
      if (this.pos === -1) this.pos = this.input.length
      else this.pos++  // Skip the closing parenthesis

      // Add a basic parameter placeholder
      params.push({ name: "params" })

      return params
    }
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

module.exports = acorn
