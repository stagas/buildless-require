require.debug = true

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

  describe('Side effects', () => {
    it('should handle modules with side effects', () => {
      require('./fixtures/side-effect-exports.js')
      assert(globalThis.sideEffectValue === 42, 'side effect occurred')
    })

    it('should handle empty exports', () => {
      const empty = require('./fixtures/side-effect-exports.js')
      assert(Object.keys(empty).length === 0, 'empty export has no properties')
    })
  })

  describe('Generator exports', () => {
    const generators = require('./fixtures/generator-exports.js')

    it('should handle generator function exports', () => {
      const gen = generators.numberGenerator()
      assert(gen.next().value === 1, 'first yield works')
      assert(gen.next().value === 2, 'second yield works')
      assert(gen.next().value === 3, 'third yield works')
      assert(gen.next().done === true, 'generator completes')
    })

    it('should handle async generator exports', async () => {
      const asyncGen = generators.asyncGenerator()
      assert((await asyncGen.next()).value === 'a', 'first async yield works')
      assert((await asyncGen.next()).value === 'b', 'second async yield works')
      assert((await asyncGen.next()).value === 'c', 'third async yield works')
      assert((await asyncGen.next()).done === true, 'async generator completes')
    })
  })

  describe('Aggregating exports', () => {
    const aggregated = require('./fixtures/aggregating-exports.js')

    it('should handle namespace re-exports', () => {
      assert(typeof aggregated.generators === 'object', 'generators namespace exists')
      assert(typeof aggregated.generators.numberGenerator === 'function', 'has numberGenerator')
      assert(typeof aggregated.sideEffects === 'object', 'sideEffects namespace exists')
    })

    it('should handle individual re-exports', () => {
      assert(typeof aggregated.numberGenerator === 'function', 'direct re-export works')
    })

    it('should handle renamed re-exports', () => {
      assert(typeof aggregated.renamedAsync === 'function', 'renamed re-export works')
    })
  })
})
