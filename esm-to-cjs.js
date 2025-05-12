const acorn = require('./acorn.js')

// Pure AST-based transformer for ESM to CJS conversion
module.exports = function esmToCjs(code, moduleName, currentPath) {
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

  // Parse the input code to an AST
  const ast = acorn.parse(code, {
    ecmaVersion: 2022,
    sourceType: 'module',
    allowAwaitOutsideFunction: true,
    allowYieldOutsideFunction: true
  })

  // Categorize all nodes
  const nonExportImportNodes = []
  const importDeclarations = []
  const exportDefaultDeclarations = []
  const exportNamedDeclarations = []
  const exportAllDeclarations = []

  // Separate the nodes by type for organized processing
  for (const node of ast.body) {
    if (node.type === 'ImportDeclaration') {
      importDeclarations.push(node)
    } else if (node.type === 'ExportDefaultDeclaration') {
      exportDefaultDeclarations.push(node)
    } else if (node.type === 'ExportNamedDeclaration') {
      exportNamedDeclarations.push(node)
    } else if (node.type === 'ExportAllDeclaration') {
      exportAllDeclarations.push(node)
    } else {
      nonExportImportNodes.push(node)
    }
  }

  // Start building the output
  let output = ['var exports = module.exports;', '']
  let exportNames = []
  let defaultExport = null

  // Process all non-export/import nodes first to maintain code order
  for (const node of nonExportImportNodes) {
    const originalCode = code.substring(node.start, node.end)
    output.push(originalCode)
  }

  // Process export declarations with declarations (hoisted to top level)
  for (const node of exportNamedDeclarations) {
    // Skip empty export { } nodes
    if (!node.declaration && node.specifiers && node.specifiers.length === 0) {
      continue
    }
    if (node.declaration) {
      // For export declarations (export function x() {}, export const x = 1)
      const declarationCode = code.substring(node.declaration.start, node.declaration.end)
      output.push(declarationCode)

      if (node.declaration.type === 'VariableDeclaration') {
        // For variable declarations, add exports for each variable
        for (const declarator of node.declaration.declarations) {
          if (declarator.id && declarator.id.name) {
            const name = declarator.id.name
            output.push(`exports.${name} = ${name};`)
          }
        }
      } else if (node.declaration.type === 'FunctionDeclaration' ||
        node.declaration.type === 'ClassDeclaration') {
        // For function and class declarations, add export for the name
        if (node.declaration.id && node.declaration.id.name) {
          const name = node.declaration.id.name
          output.push(`exports.${name} = ${name};`)
        }
      }
    }
    // Always handle specifiers for named exports (e.g. export { hello })
    if (node.specifiers && node.specifiers.length) {
      for (const specifier of node.specifiers) {
        if (specifier.type === 'ExportSpecifier') {
          const local = specifier.local.name
          const exported = specifier.exported.name
          output.push(`exports.${exported} = ${local};`)
        }
        // ExportNamespaceSpecifier is handled in the re-export section only
      }
    }
  }

  // Process import declarations
  for (const node of importDeclarations) {
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

  // Process export-from declarations (re-exports)
  for (const node of exportNamedDeclarations) {
    if (node.source) {
      // Re-export: export { name1, name2 } from 'module'
      const source = node.source.value
      const resolvedPath = resolveImportPath(source)
      const moduleName = `_mod${exportNamedDeclarations.indexOf(node)}`

      output.push(`const ${moduleName} = require('${resolvedPath}');`)

      for (const specifier of node.specifiers) {
        if (specifier.type === 'ExportSpecifier') {
          const local = specifier.local.name
          const exported = specifier.exported.name
          output.push(`exports.${exported} = ${moduleName}.${local};`)
        } else if (specifier.type === 'ExportNamespaceSpecifier') {
          // export * as name from 'module'
          const name = specifier.exported.name
          output.push(`exports.${name} = ${moduleName};`)
        }
      }
    }
  }

  // Process export * from 'module' declarations
  for (const node of exportAllDeclarations) {
    const source = node.source.value
    const resolvedPath = resolveImportPath(source)
    const moduleName = `_mod${exportAllDeclarations.indexOf(node)}`

    output.push(`const ${moduleName} = require('${resolvedPath}');`)
    output.push(`Object.assign(exports, ${moduleName});`)
  }

  // Process default exports
  for (const node of exportDefaultDeclarations) {
    if (node.declaration.type === 'Identifier') {
      // export default existingVariable
      defaultExport = node.declaration.name
    } else {
      // export default expression or anonymous function/class
      const declarationCode = code.substring(node.declaration.start, node.declaration.end)

      // For anonymous declarations, create a named variable
      const defaultVarName = '_default'
      output.push(`const ${defaultVarName} = ${declarationCode};`)
      defaultExport = defaultVarName
    }
  }

  // Add named exports at the end of the file
  for (const { local, exported } of exportNames) {
    output.push(`exports.${exported} = ${local};`)
  }

  // Add default export
  if (defaultExport) {
    output.push(`exports.default = ${defaultExport};`)

    // Check if the default export is a function or class that we want to make callable
    if (code.includes(`function ${defaultExport}`) || code.includes(`class ${defaultExport}`)) {
      output.push(`module.exports = Object.assign(exports.default, exports);`)
    }
  }

  return output.join('\n')
}
