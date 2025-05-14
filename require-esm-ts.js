// add ESM-to-CJS transform
const esmToCjs = require('./esm-to-cjs.js')
require.transforms.push({
  test: m => /\b(?:import|export)\b/.test(m.body),
  transform: m => esmToCjs(m.body, m.name, m.path)
})

// add support for TypeScript
const ts = require('@swc/wasm-web')
require.transforms.unshift({
  test: m => m.path.endsWith('.ts') || m.path.endsWith('.tsx'),
  transform: m => ts.transformSync(m.body, {
    filename: m.path.split('/').pop(),
    jsc: {
      transform: {
        react: {
          runtime: 'automatic',
          importSource: 'preact'
        }
      }
    },
  }).code
})

// run all TypeScript inline script tags
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runTypeScriptScripts)
}
else {
  runTypeScriptScripts()
}

async function runTypeScriptScripts() {
  await ts.default()
  document.querySelectorAll('script[type="text/typescript"]').forEach(script => {
    if (script.src) {
      require(script.src)
    }
    else {
      const m = require.eval({
        body: script.textContent,
        name: '',
        path: '',
      })
      m.run()
    }
  })
}
