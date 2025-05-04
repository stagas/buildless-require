describe('ESM', () => {
  describe('Named exports', () => {
    const named = require('./fixtures/named-exports.js')

    it('should handle named value export', () => {
      assert(named.namedValue === 42, 'named value export works')
    })

    it('should handle named object export', () => {
      assert(named.namedObject.foo === 'bar', 'named object export works')
    })

    it('should handle named function export', () => {
      assert(named.namedFunction() === 'hello', 'named function export works')
    })

    it('should handle named class export', () => {
      assert(new named.NamedClass().method() === 'world', 'named class export works')
    })
  })

  describe('Default export', () => {
    const def = require('./fixtures/default-export.js')

    it('should handle default export', () => {
      assert(def.default === 'default', 'default export works')
    })
  })

  describe('Renamed exports', () => {
    const renamed = require('./fixtures/renamed-exports.js')

    it('should handle renamed export', () => {
      assert(renamed.renamedValue === 42, 'renamed export works')
    })
  })

  describe('Multiple exports', () => {
    const multiple = require('./fixtures/multiple-exports.js')

    it('should handle multiple exports', () => {
      assert(multiple.multipleA === 1, 'first multiple export works')
      assert(multiple.multipleB === 2, 'second multiple export works')
    })
  })

  describe('Async exports', () => {
    const async = require('./fixtures/async-exports.js')

    it('should handle async function export', async () => {
      const result = await async.asyncFunction()
      assert(result === 'async', 'async function export works')
    })
  })
})
