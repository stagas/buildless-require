module.exports = function esmToCjs(code, moduleName, currentPath) {
  // Extract filename from path to use in default naming
  const fileName = moduleName.split('/').pop().replace(/\.\w+$/, '')
  const safeFileName = fileName.replace(/[^a-zA-Z0-9_]/g, '_')

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

  // Replace import statements with destructuring
  code = code.replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
    function (match, importNames, importPath) {
      const resolvedPath = resolveImportPath(importPath)
      const entries = importNames.split(',').map(entry => {
        const parts = entry.trim().split(/\s+as\s+/)
        const importName = parts[0].trim()
        const localName = parts[1]?.trim() || importName

        if (importName === 'default') {
          return `default: ${localName}`
        }
        return `${importName}: ${localName}`
      })

      return `const { ${entries.join(', ')} } = require('${resolvedPath}')`
    }
  )

  // Handle compact import syntax without spaces like: import{Q as h}from"./chunk-QVIHGVPD.mjs"
  code = code.replace(/import\{([^}]+)\}from["']([^"']+)["']/g,
    function (match, importNames, importPath) {
      const resolvedPath = resolveImportPath(importPath)
      const entries = importNames.split(',').map(entry => {
        let parts = []
        if (entry.includes('as')) {
          parts = entry.split(/\s*as\s*/) // Split by "as" with or without spaces
        } else {
          parts = [entry]
        }
        const importName = parts[0].trim()
        const localName = parts[1]?.trim() || importName

        if (importName === 'default') {
          return `default: ${localName}`
        }
        return `${importName}: ${localName}`
      })

      return `const { ${entries.join(', ')} } = require('${resolvedPath}')`
    }
  )

  // Replace import statements for default imports
  code = code.replace(/import\s+([^{*\s,]+)\s+from\s+['"]([^'"]+)['"]/g,
    function (match, importName, importPath) {
      const resolvedPath = resolveImportPath(importPath)
      return `const ${importName} = require('${resolvedPath}').default || require('${resolvedPath}')`
    }
  )

  // Handle compact default imports without spaces like: import Q from"./chunk-QVIHGVPD.mjs"
  code = code.replace(/import([^{*\s,]+)from["']([^"']+)["']/g,
    function (match, importName, importPath) {
      const resolvedPath = resolveImportPath(importPath)
      return `const ${importName.trim()} = require('${resolvedPath}').default || require('${resolvedPath}')`
    }
  )

  // Replace standard namespace imports
  code = code.replace(/import\s+\*\s+as\s+([^\s]+)\s+from\s+['"]([^'"]+)['"]/g,
    function (match, importName, importPath) {
      const resolvedPath = resolveImportPath(importPath)
      return `const ${importName} = require('${resolvedPath}')`
    }
  )

  // Handle compact namespace imports without spaces like: import*as Q from"./chunk-QVIHGVPD.mjs"
  code = code.replace(/import\*as\s*([^\s]+)\s*from["']([^"']+)["']/g,
    function (match, importName, importPath) {
      const resolvedPath = resolveImportPath(importPath)
      return `const ${importName.trim()} = require('${resolvedPath}')`
    }
  )

  // Handle variant with space after import but before *as
  code = code.replace(/import\s+\*as\s*([^\s]+)\s*from["']([^"']+)["']/g,
    function (match, importName, importPath) {
      const resolvedPath = resolveImportPath(importPath)
      return `const ${importName.trim()} = require('${resolvedPath}')`
    }
  )

  // Handle side-effect imports (without binding) like: import '/foo' or import "./styles.css"
  code = code.replace(/import\s+['"]([^'"]+)['"]/g,
    function (match, importPath) {
      const resolvedPath = resolveImportPath(importPath)
      return `require('${resolvedPath}')`
    }
  )

  // Replace dynamic imports
  code = code.replace(/import\s*\(([^)]+)\)/g, function (match, importExpr) {
    // If it's a string literal, we can resolve it
    if (importExpr.trim().startsWith("'") || importExpr.trim().startsWith('"')) {
      const importPath = importExpr.trim().slice(1, -1)
      const resolvedPath = resolveImportPath(importPath)
      return `Promise.resolve(require('${resolvedPath}'))`
    }
    return `Promise.resolve(require(${importExpr}))`
  })

  // Handle export * from statements
  code = code.replace(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g,
    function (match, importPath) {
      const resolvedPath = resolveImportPath(importPath)
      return `Object.assign(module.exports, require('${resolvedPath}')); Object.defineProperty(module.exports, 'default', { enumerable: false });`
    }
  )

  // Handle named export from statements
  code = code.replace(/export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
    function (match, exportNames, importPath) {
      const resolvedPath = resolveImportPath(importPath)
      const names = exportNames.split(',').map(n => n.trim())
      const result = []

      for (const name of names) {
        if (name.includes(' as ')) {
          const [sourceName, targetName] = name.split(' as ').map(n => n.trim())
          if (sourceName === 'default') {
            result.push(`Object.defineProperty(exports, '${targetName}', { enumerable: true, get: function() { return require('${resolvedPath}').default; } });`)
          }
          else {
            result.push(`Object.defineProperty(exports, '${targetName}', { enumerable: true, get: function() { return require('${resolvedPath}').${sourceName}; } });`)
          }
        }
        else if (name === 'default') {
          result.push(`Object.defineProperty(module.exports, 'default', { enumerable: true, get: function() { return require('${resolvedPath}').default; } });`)
        }
        else {
          result.push(`Object.defineProperty(exports, '${name}', { enumerable: true, get: function() { return require('${resolvedPath}').${name}; } });`)
        }
      }

      return result.join('\n')
    }
  )

  // Handle anonymous default export with object or expression
  code = code.replace(/export\s+default\s+({[^;]*}|[^;\s]+)/g,
    'module.exports.default = $1'
  )

  // Handle object literal exports
  code = code.replace(/export\s+(const|let|var)\s+([^\s(=]+)\s*=\s*({[\s\S]*?}\s*);?/g,
    function (match, type, name, value) {
      return `${type} ${name} = ${value.trim()};\nexports.${name} = ${name}`
    }
  )

  // Handle exported function declarations with spaces
  code = code.replace(/export\s+(const|let|var)\s+([^\s(=]+)\s*=\s*function\s*\(([\s\S]*?)\)\s*{([\s\S]*?)\n}/g,
    function (match, type, name, params, body) {
      return `${type} ${name} = function(${params}) {${body}\n}\nexports.${name} = ${name}`
    }
  )

  // Handle other exports
  code = code.replace(/export\s+(const|let|var)\s+([^\s(=]+)\s*=\s*([\s\S]*?)(?:;|\n|$)/g,
    function (match, type, name, value) {
      return `${type} ${name} = ${value.trim()};\nexports.${name} = ${name}`
    }
  )

  // Handle function and class exports separately
  code = code.replace(/export\s+(function|class)\s+([^\s(=]+)/g,
    function (match, type, name) {
      return `${type} ${name}\nexports.${name} = ${name}`
    }
  )

  // Handle destructured exports like export { a, b, c }
  code = code.replace(/export\s+\{([^}]+)\}/g,
    function (match, exportNames) {
      const names = exportNames.split(',')
      const result = []

      for (const name of names) {
        if (name.includes(' as ')) {
          const [sourceName, targetName] = name.split(' as ').map(n => n.trim())
          result.push(`exports.${targetName} = ${sourceName}`)
        } else if (name.trim() === 'default') {
          // If 'default' is exported, use the safe name pattern
          const defaultVar = `_${safeFileName}_default`
          result.push(`exports.default = typeof ${defaultVar} !== 'undefined' ? ${defaultVar} : module.exports.default`)
        } else {
          result.push(`exports.${name.trim()} = ${name.trim()}`)
        }
      }

      return result.join('\n')
    }
  )

  // Handle compact export syntax (without spaces) like: ;export{a as b,c as default};
  code = code.replace(/(\W)export\{([^}]+)\}(\W)/g,
    function (match, prefix, exportNames, suffix) {
      const names = exportNames.split(',')
      const transformedExports = []

      for (const name of names) {
        if (name.includes('as')) {
          const [sourceName, targetName] = name.split(/\s*as\s*/) // Handle with or without spaces
          transformedExports.push(`exports.${targetName.trim()} = ${sourceName.trim()}`)
        }
        else {
          transformedExports.push(`exports.${name.trim()} = ${name.trim()}`)
        }
      }

      // Preserve the prefix and suffix characters (like semicolons)
      return prefix + transformedExports.join(';') + suffix
    }
  )

  // Handle special case of compact exports at start of line or file
  code = code.replace(/^export\{([^}]+)\}(\W)/g,
    function (match, exportNames, suffix) {
      const names = exportNames.split(',')
      const transformedExports = []

      for (const name of names) {
        if (name.includes('as')) {
          const [sourceName, targetName] = name.split(/\s*as\s*/)
          transformedExports.push(`exports.${targetName.trim()} = ${sourceName.trim()}`)
        } else {
          transformedExports.push(`exports.${name.trim()} = ${name.trim()}`)
        }
      }

      return transformedExports.join(';') + suffix
    }
  )

  // Handle special case of compact exports at end of line or file
  code = code.replace(/(\W)export\{([^}]+)\}$/g,
    function (match, prefix, exportNames) {
      const names = exportNames.split(',')
      const transformedExports = []

      for (const name of names) {
        if (name.includes('as')) {
          const [sourceName, targetName] = name.split(/\s*as\s*/)
          transformedExports.push(`exports.${targetName.trim()} = ${sourceName.trim()}`)
        }
        else {
          transformedExports.push(`exports.${name.trim()} = ${name.trim()}`)
        }
      }

      return prefix + transformedExports.join(';')
    }
  )

  // Handle standalone compact export (no prefix/suffix)
  code = code.replace(/^export\{([^}]+)\}$/g,
    function (match, exportNames) {
      const names = exportNames.split(',')
      const transformedExports = []

      for (const name of names) {
        if (name.includes('as')) {
          const [sourceName, targetName] = name.split(/\s*as\s*/)
          transformedExports.push(`exports.${targetName.trim()} = ${sourceName.trim()}`)
        }
        else {
          transformedExports.push(`exports.${name.trim()} = ${name.trim()}`)
        }
      }

      return transformedExports.join(';')
    }
  )

  // Handle minified code pattern with var declarations followed by compact exports
  code = code.replace(/(var\s+[^;]+);export\{([^}]+)\}/g,
    function (match, varDecl, exportNames) {
      const names = exportNames.split(',')
      const transformedExports = []

      for (const name of names) {
        if (name.includes('as')) {
          const [sourceName, targetName] = name.split(/\s*as\s*/)
          transformedExports.push(`exports.${targetName.trim()} = ${sourceName.trim()}`)
        }
        else {
          transformedExports.push(`exports.${name.trim()} = ${name.trim()}`)
        }
      }

      return `${varDecl};${transformedExports.join(';')}`
    }
  )

  // Handle minified exports with assignments (no spaces)
  code = code.replace(/export (const|let|var)([^\s(=]+)=([^;]+)/g,
    function (match, type, name, value) {
      return `${type} ${name.trim()}=${value}\nexports.${name.trim()} = ${name.trim()}`
    }
  )

  return code
}
