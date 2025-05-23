(function () {

  let importmapObj
  const importmap = document.querySelector('script[type="importmap"]')
  if (importmap) {
    if (importmap.src) {
      const req = new XMLHttpRequest()
      req.open('get', importmap.src, false)
      req.send(null)
      if (req.status >= 200 && req.status < 400) {
        importmapObj = JSON.parse(req.responseText)
      }
    }
    else {
      importmapObj = JSON.parse(importmap.textContent ?? '{}')
    }
  }
  importmapObj ??= {}

  self.require = require

  require.paths = ['/node_modules']

  require.debug = false

  require.modules = Object.create(null)

  require.transforms = []

  require.transform = function (m) {
    for (const [index, transform] of require.transforms.entries()) {
      if (transform.test(m)) {
        if (require.debug) console.log(`Before [${index}]`, m.body)
        m.body = transform.transform(m)
        if (require.debug) console.log(`After [${index}]`, m.body)
      }
    }
  }

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
    else if (importmapObj.imports?.[name]) {
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

  require.eval = function (m) {
    require.transform(m)

    m.module = { exports: {} }
    m.exports = m.module.exports
    m.require = require.bind(null, m.path)
    Object.assign(m.require, require)
    m.fn = new Function('module', 'exports', 'require', m.body)
    m.didRun = false
    m.run = () => {
      m.didRun = true
      m.fn(m.module, m.module.exports, m.require)
      m.exports = m.module.exports // Update exports after run
    }

    return m
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

    m.name = name
    m.path = m.request.responseURL
    m.body = m.request.responseText

    require.eval(m)

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
