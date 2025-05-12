// add ESM-to-CJS transform
const esmToCjs = require('./esm-to-cjs.js')
require.transforms.push({
  test: m => /\b(?:import|export)\b/.test(m.body),
  transform: m => esmToCjs(m.body, m.name, m.path)
})
