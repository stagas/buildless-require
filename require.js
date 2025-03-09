(function () {

  const importmap = document.querySelector('script[type="importmap"]').textContent
  const importmapObj = JSON.parse(importmap)

  self.require = require

  require.paths = ['/node_modules']

  require.debug = true

  require.modules = Object.create(null)

  require.resolve = function (name, parent) {
    if ('..' === name.substr(0, 2)) {
      var parentParts = parent.split('/')
      var nameParts = name.split('/')
      var fileName = parentParts.pop()
      while (nameParts[0] === '..' && nameParts.shift()) parentParts.pop()
      parentParts.push(fileName)
      name = nameParts.join('/')
      parent = parentParts.join('/')
    }
    else if (importmapObj.imports[name]) {
      return importmapObj.imports[name]
    }
    else if ('/' === name[0]) {
      parent = self.location.origin
    }
    else if ('.' !== name[0]) {
      parent = self.location.origin
      // to work with blob created Workers
      if ('blob' === parent.substr(0, 4)) {
        parent = self.location.origin
      }
    }

    var path = new URL(name, parent).href

    if (path in require.modules) {
      return require.modules[path].path
    }
    else {
      return path
    }
  }

  require.load = function (name, parent) {
    var path = require.resolve(name, parent)

    var m
      = require.modules[path]
      = require.modules[path]
      || {}

    if (m.isFetched) return m

    m.request = getModule(path)
    m.isFetched = true

    if (m.request === false) return m

    m.path = m.request.responseURL
    m.body = m.request.responseText

    if (m.body.includes('import') || m.body.includes('export')) {
      m.body = transformModuleSyntax(m.body, name, m.path)
    }

    m.exports = {}
    m.require = require.bind(null, m.path)
    m.fn = new Function('module', 'exports', 'require', m.body)
    m.didRun = false

    require.modules[m.path] = m

    return m
  }

  function require(parent, name) {
    if (arguments.length < 2) {
      name = parent
      parent = self.location.href
    }

    var m = require.load(name, parent)

    if (!m.request) {
      throw new Error('Unable to load module "' + name + '" under "' + parent + '"')
    }
    else if (!m.didRun) {
      m.didRun = true
      m.fn(m, m.exports, m.require)
    }

    return m.exports
  }

  function transformModuleSyntax(code, moduleName, currentPath) {
    if (require.debug) console.log('Before transform:', code)

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
            return `${localName}: _default`
          }
          return `${localName}: ${importName}`
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

    // Replace namespace imports
    code = code.replace(/import\s+\*\s+as\s+([^\s]+)\s+from\s+['"]([^'"]+)['"]/g,
      function (match, importName, importPath) {
        const resolvedPath = resolveImportPath(importPath)
        return `const ${importName} = require('${resolvedPath}')`
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

    // Handle default exports of classes/functions
    code = code.replace(/export\s+default\s+(class|function)(\s+[^\s(]+|\s*\([^)]*\)\s*{)/g, function (match, type, rest) {
      if (rest.trim()[0] === '(') {
        // Anonymous function with arguments: function() {}
        return `module.exports.default = ${type}${rest}`
      }
      else {
        // Named class/function: class Name {} or function name() {}
        const name = rest.trim().split(/\s+/)[0]
        return `${type}${rest}\nmodule.exports.default = ${name}`
      }
    })

    // Handle anonymous default export with object or expression
    code = code.replace(/export\s+default\s+({[^;]*}|[^;\s]+)/g,
      'module.exports.default = $1'
    )

    // Handle regular named exports (let/const/var/function/class)
    code = code.replace(/export\s+(const|let|var|function|class)\s+([^\s(=]+)/g,
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

    if (require.debug) console.log('After transform:', code)

    return code
  }

  function getModule(path) {
    var originalPath = path
    var path = stripLocation(path)
    return get(path) || pathsGet(require.paths, path) || get(originalPath)
  }

  function stripLocation(path) {
    var index = path.indexOf(self.location.origin)
    if (index === 0) path = path.substr(self.location.origin.length)
    return path
  }

  function pathsGet(paths, path) {
    paths = paths.slice()
    var p
    var req
    while (p = paths.shift()) {
      req = get(p + path)
      if (req) return req
    }
  }

  function get(path) {
    return (
      xhr(path) ||
      xhr(path + '.js') ||
      xhr(path + '.cjs') ||
      xhr(path + '/index.js') ||
      xhr(path + '/index.cjs')
    )
  }

  function xhr(path) {
    var req = new XMLHttpRequest
    req.open('get', path, false)
    req.send(null)
    if (req.status >= 200 && req.status < 400) {
      return req
    } else {
      return false
    }
  }

})()
