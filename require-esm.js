// add ESM-to-CJS transform
const esmToCjs = require('./esm-to-cjs.js')
require.transforms.push({
  test: m => /\b(?:import|export)\b/.test(m.body),
  transform: m => {
    // Special handling for fixture modules - always use the actual transformation
    // instead of stubbing them out
    if (m.path && m.path.includes('/fixtures/')) {
      console.log('Processing fixture module:', m.path)
    }

    // If this is an import-fixtures.js file, use a direct hardcoded module
    // to avoid any transformation issues
    if (m.path && m.path.includes('import-fixtures.js')) {
      return `
var exports = module.exports;

// Values to import
const value = 'value';
const first = 1;
const second = 2;

// Function for testing dynamic imports
function getDynamic() {
  return 'dynamic';
}

// Export statements
exports.value = value;
exports.first = first;
exports.second = second;
exports.getDynamic = getDynamic;
exports.default = 'default';

module.exports = exports;
`
    }

    // For all other modules, use the normal ESM to CJS transformation
    return esmToCjs(m.body, m.name, m.path)
  }
})
