const acorn = require('./acorn.js')

// Parser and transformer for ESM to CJS conversion
module.exports = function esmToCjs(code, moduleName, currentPath) {
  // Pre-process the code to remove empty export statements
  code = code.replace(/export\s*\{\s*\}\s*;?/g, '')

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
    let output = []
    let exportNames = []
    let defaultExport = null
    let hasAwait = code.includes('await ') || code.includes('async function') // Check for both await and async

    // Start with CommonJS exports setup
    output.push('var exports = module.exports;')
    output.push('')

    // Process all non-export/import nodes first
    for (const node of ast.body) {
      if (node.type !== 'ImportDeclaration' &&
        node.type !== 'ExportDefaultDeclaration' &&
        node.type !== 'ExportNamedDeclaration' &&
        node.type !== 'ExportAllDeclaration') {
        // For declarations (variables, functions, classes), output them directly
        const originalCode = code.substring(node.start, node.end)
        output.push(originalCode)
      } else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
        // For export declarations (export function x() {}, export const x = 1),
        // output the declaration without the 'export' keyword
        const declarationCode = code.substring(node.declaration.start, node.declaration.end)
        output.push(declarationCode)
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
    // Parse the input code to an AST with improved options for generator functions
    const ast = acorn.parse(code, {
      ecmaVersion: 2022,
      sourceType: 'module',
      allowAwaitOutsideFunction: true,
      allowYieldOutsideFunction: true
    })
    // Transform the AST to CommonJS
    return transform(ast)
  } catch (err) {
    console.error('Error parsing or transforming module:', err)
    // Safe fallback: only remove 'export' and 'import' keywords, do not try to parse or assign export default
    let processedCode = code
      // Remove all 'export' keywords (keep the rest of the line)
      .replace(/^\s*export\s+/gm, '')
      // Remove all 'import' statements (side-effect imports)
      .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')

    // Collect named exports for the end
    const namedExportMatches = [...code.matchAll(/export\s*\{([^}]+)\}/g)]
    let exportLines = []
    for (const match of namedExportMatches) {
      const names = match[1].split(',')
      for (const name of names) {
        const parts = name.trim().split(/\s+as\s+/)
        const local = parts[0].trim()
        const exported = parts[1] ? parts[1].trim() : local
        exportLines.push(`exports.${exported} = ${local};`)
      }
    }
    // Remove named export lines
    processedCode = processedCode.replace(/export\s*\{[^}]+\};?/g, '')

    return [
      'var exports = module.exports;',
      '',
      processedCode.trim(),
      '',
      ...exportLines,
      '',
      'module.exports = exports;'
    ].join('\n')
  }
}
