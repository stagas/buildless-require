// add ESM-to-CJS transform
const esmToCjs = require('./esm-to-cjs.js')
require.transforms.push({
  test: m => /\b(?:import|export)\b/.test(m.body),
  transform: m => esmToCjs(m.body, m.name, m.path)
})

// add TypeScript type-stripping transform
const amaro = require('amaro') // amaro is an ESM module
require.transforms.unshift({
  test: m => m.path.endsWith('.ts'),
  transform: m => amaro.transformSync(m.body).code
})

// run all TypeScript inline script tags
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runTypeScriptScripts)
} else {
  runTypeScriptScripts()
}

function runTypeScriptScripts() {
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
