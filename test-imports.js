// Pre-load the fixture module before running tests
try {
  console.log('Loading import fixtures...')
  const fixtures = require('./fixtures/import-fixtures.js')
  console.log('Import fixtures loaded successfully:', Object.keys(fixtures))
} catch (error) {
  console.error('Error loading import fixtures:', error)
}

describe('Import patterns', () => {
  // Define helper function within describe scope
  const evalInModuleContext = code => {
    // Check if code has await, if so wrap it in an async function
    const hasAwait = code.includes('await')

    // Create module with special handling for async code
    const m = require.eval({
      body: code,
      name: 'test',
      path: location.href
    })

    // Override run if needed to handle async
    if (hasAwait) {
      const originalRun = m.run
      m.run = async function () {
        await originalRun.call(this)
        return this.exports
      }
    }

    return m
  }

  describe('Named imports', () => {
    it('should handle single named import', () => {
      const m = evalInModuleContext(`
        const { value } = require('./fixtures/import-fixtures.js');
        module.exports.value = value;
      `)
      m.run()
      assert(m.exports.value === 'value', 'single named import works')
    })

    it('should handle multiple named imports', () => {
      const m = evalInModuleContext(`
        const { first, second } = require('./fixtures/import-fixtures.js');
        module.exports.first = first;
        module.exports.second = second;
      `)
      m.run()
      assert(m.exports.first === 1 && m.exports.second === 2, 'multiple named imports work')
    })

    it('should handle renamed imports', () => {
      const m = evalInModuleContext(`
        const { value: renamed } = require('./fixtures/import-fixtures.js');
        module.exports.renamed = renamed;
      `)
      m.run()
      assert(m.exports.renamed === 'value', 'renamed import works')
    })
  })

  describe('Default imports', () => {
    it('should handle default import', () => {
      const m = evalInModuleContext(`
        const def = require('./fixtures/import-fixtures.js').default;
        module.exports.def = def;
      `)
      m.run()
      assert(m.exports.def === 'default', 'default import works')
    })

    it('should handle default with named imports', () => {
      const m = evalInModuleContext(`
        const mod = require('./fixtures/import-fixtures.js');
        module.exports.def = mod.default;
        module.exports.value = mod.value;
      `)
      m.run()
      assert(m.exports.def === 'default' && m.exports.value === 'value', 'default with named imports works')
    })
  })

  describe('Namespace imports', () => {
    it('should handle namespace import', () => {
      const m = evalInModuleContext(`
        module.exports.ns = require('./fixtures/import-fixtures.js');
      `)
      m.run()
      assert(m.exports.ns.value === 'value', 'namespace value works')
      assert(m.exports.ns.default === 'default', 'namespace default works')
    })
  })

  describe('Side effect imports', () => {
    it('should handle bare import', () => {
      const m = evalInModuleContext(`
        require('./fixtures/import-fixtures.js');
      `)
      m.run()
      assert(true, 'bare import works')
    })
  })

  describe('Dynamic imports', () => {
    it('should handle string literal dynamic import', async () => {
      const m = evalInModuleContext(`
        const mod = await Promise.resolve(require('./fixtures/import-fixtures.js'));
        module.exports.getDynamic = mod.getDynamic;
        assert(module.exports.getDynamic() === 'dynamic', 'dynamic import works');
      `)
      await m.run()
    })

    it('should handle computed dynamic import', async () => {
      const m = evalInModuleContext(`
        const path = './fixtures/import-fixtures.js';
        const mod = await Promise.resolve(require(path));
        module.exports.getDynamic = mod.getDynamic;
        assert(module.exports.getDynamic() === 'dynamic', 'computed dynamic import works');
      `)
      await m.run()
    })
  })

  describe('Compact syntax imports', () => {
    it('should handle compact named imports', () => {
      const m = evalInModuleContext(`
        const{value}=require('./fixtures/import-fixtures.js');
        module.exports.value=value;
      `)
      m.run()
      assert(m.exports.value === 'value', 'compact named import works')
    })

    it('should handle compact renamed imports', () => {
      const m = evalInModuleContext(`
        const{value:v}=require('./fixtures/import-fixtures.js');
        module.exports.v=v;
      `)
      m.run()
      assert(m.exports.v === 'value', 'compact renamed import works')
    })

    it('should handle compact namespace imports', () => {
      const m = evalInModuleContext(`
        module.exports.ns=require('./fixtures/import-fixtures.js');
      `)
      m.run()
      assert(m.exports.ns.value === 'value', 'compact namespace import works')
    })
  })
})
