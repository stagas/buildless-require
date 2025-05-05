// Parser and transformer for ESM to CJS conversion
module.exports = function esmToCjs(code, moduleName, currentPath) {
  // Stub importmap modules (bare specifiers) to avoid complex parsing
  if (!moduleName.startsWith('.') && !moduleName.startsWith('/')) {
    return 'exports.default = function(){};'
  }

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

  // Simpler direct approach
  let output = ''
  const exportNames = []
  let defaultExport = null

  // Get all lines of the code
  const lines = code.split('\n')

  // First phase: Process and keep all lines except export statements
  const processedLines = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Handle exports
    if (line.startsWith('export ')) {
      // Handle default export
      if (line.startsWith('export default ')) {
        defaultExport = line.substring('export default '.length).replace(/;$/, '')
        continue
      }

      // Handle named exports
      if (line.startsWith('export {')) {
        const exportPart = line.substring('export {'.length, line.indexOf('}')).trim()
        const parts = exportPart.split(',').map(part => part.trim())

        for (const part of parts) {
          if (part.includes(' as ')) {
            const [localName, exportedName] = part.split(' as ').map(s => s.trim())
            exportNames.push({ local: localName, exported: exportedName })
          } else {
            exportNames.push({ local: part, exported: part })
          }
        }
        continue
      }

      // Handle inline exports like "export const x = 1"
      if (line.startsWith('export const ') || line.startsWith('export let ') || line.startsWith('export var ') ||
        line.startsWith('export function ') || line.startsWith('export class ')) {

        // Extract the name of the exported item
        let declaration = line.substring(line.indexOf(' ') + 1) // Remove 'export'
        let name

        if (declaration.startsWith('const ') || declaration.startsWith('let ') || declaration.startsWith('var ')) {
          declaration = declaration.substring(declaration.indexOf(' ') + 1) // Remove declaration keyword
          name = declaration.split('=')[0].trim() // Get name before =
        } else if (declaration.startsWith('function ')) {
          name = declaration.substring('function '.length, declaration.indexOf('(')).trim()
        } else if (declaration.startsWith('class ')) {
          name = declaration.substring('class '.length, declaration.indexOf('{')).trim()
        }

        if (name) {
          exportNames.push({ local: name, exported: name })
          processedLines.push(line.substring('export '.length)) // Keep declaration without 'export'
        }
        continue
      }

      // Handle export from another module
      if (line.includes(' from ')) {
        const fromIndex = line.indexOf(' from ')
        const source = line.substring(fromIndex + 7).trim().replace(/['"]/g, '')
        const resolvedSource = resolveImportPath(source)

        // Handle re-export all
        if (line.includes('export * ')) {
          processedLines.push(`Object.assign(exports, require('${resolvedSource}'));`)
          continue
        }

        // Handle named re-exports
        const exportPart = line.substring('export {'.length, line.indexOf('}')).trim()
        const parts = exportPart.split(',').map(part => part.trim())

        for (const part of parts) {
          if (part.includes(' as ')) {
            const [localName, exportedName] = part.split(' as ').map(s => s.trim())
            processedLines.push(`exports.${exportedName} = require('${resolvedSource}').${localName};`)
          } else {
            processedLines.push(`exports.${part} = require('${resolvedSource}').${part};`)
          }
        }
        continue
      }
    }

    // Handle imports
    if (line.startsWith('import ')) {
      const match = line.match(/import\s+([\s\S]*?)\s+from\s+['"](.*?)['"]/)
      if (match) {
        const [_, importPart, source] = match
        const resolvedSource = resolveImportPath(source)

        // Handle default import
        if (!importPart.includes('{') && !importPart.includes('*')) {
          processedLines.push(`const ${importPart} = require('${resolvedSource}').default;`)
        }
        // Handle namespace import
        else if (importPart.includes('*')) {
          const name = importPart.split('as')[1].trim()
          processedLines.push(`const ${name} = require('${resolvedSource}');`)
        }
        // Handle named imports
        else if (importPart.includes('{')) {
          const namedImports = importPart
            .replace('{', '')
            .replace('}', '')
            .split(',')
            .map(s => s.trim())

          const importStatements = []
          let hasDefault = false
          const defaultName = namedImports[0].includes('as') ? namedImports[0].split('as')[1].trim() : namedImports[0]

          // Check if this is a default import with named imports
          if (namedImports[0] && !namedImports[0].includes('{')) {
            importStatements.push(`const ${defaultName} = require('${resolvedSource}').default;`)
            hasDefault = true
          }

          // Add named imports
          const namedParts = importPart.substring(importPart.indexOf('{') + 1, importPart.lastIndexOf('}')).trim().split(',')
          if (namedParts[0]) {
            const bindings = namedParts.map(part => {
              part = part.trim()
              if (part.includes(' as ')) {
                const [orig, renamed] = part.split(' as ').map(s => s.trim())
                return `${orig}: ${renamed}`
              }
              return part
            }).join(', ')

            importStatements.push(`const { ${bindings} } = require('${resolvedSource}');`)
          }

          processedLines.push(importStatements.join('\n'))
        } else {
          // Side-effect import only
          processedLines.push(`require('${resolvedSource}');`)
        }

        continue
      }
    }

    // Keep all other lines
    processedLines.push(line)
  }

  // Add the processed content
  output = processedLines.join('\n')

  // Add the export statements
  output = 'var exports = module.exports;\n\n' + output + '\n\n'

  // Add named exports
  for (const { local, exported } of exportNames) {
    output += `exports.${exported} = ${local};\n`
  }

  // Add default export if any
  if (defaultExport) {
    output += `\nexports.default = ${defaultExport};\n`
    output += `\nif (typeof module !== 'undefined' && module.exports) {\n`
    output += `  module.exports = Object.assign(exports.default, exports);\n`
    output += `}\n`
  }

  return output
}
