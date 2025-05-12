// Test fixture for destructuring exports
const sourceObject = {
  foo: 'foo value',
  bar: 'bar value',
  baz: 'baz value'
}

// Export using destructuring
export const { foo, bar, baz: renamedBaz } = sourceObject

// Export the source object for verification
export const source = sourceObject