// Declare values first
const namedValue = 42
const namedObject = { foo: 'bar' }
function namedFunction() { return 'hello' }
class NamedClass {
  method() { return 'world' }
}

// Multiple named values
const multipleA = 1
const multipleB = 2

// Async function
async function asyncFunction() {
  return Promise.resolve('async')
}

// Object with methods
const objectWithMethods = {
  method1() { return 1 },
  async method2() { return 2 }
}

// Now do all the exports
export { namedValue, namedObject, namedFunction, NamedClass }
export { namedValue as renamedValue }
export { multipleA, multipleB }
export { asyncFunction, objectWithMethods }

// Default export last to avoid hoisting issues
export default 'default'

// Namespace exports after all local exports
export * from './esm-import-fixtures.js'
