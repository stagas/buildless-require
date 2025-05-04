// Tests
describe('require', () => {
  it('should be defined globally', () => {
    assert(typeof require === 'function', 'require should be a function')
  })

  it('should have expected properties', () => {
    assert(Array.isArray(require.paths), 'require.paths should be an array')
    assert(typeof require.debug === 'boolean', 'require.debug should be a boolean')
    assert(typeof require.modules === 'object', 'require.modules should be an object')
    assert(Array.isArray(require.transforms), 'require.transforms should be an array')
  })

  it('should resolve paths correctly', () => {
    const path = require.resolve('./test.js', location.href)
    assert(path.endsWith('/test.js'), 'should resolve relative paths')
  })

  it('should work with importmap modules', () => {
    const confetti = require('confetti')
    assert(typeof confetti === 'object', 'should load importmap module')
    assert(typeof confetti.default === 'function', 'should have default export')
  })
})
