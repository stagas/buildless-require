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
