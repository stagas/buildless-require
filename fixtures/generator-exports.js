function* numberGenerator() {
  yield 1
  yield 2
  yield 3
}

async function* asyncGenerator() {
  yield 'a'
  yield 'b'
  yield 'c'
}

// Export after declarations
export { numberGenerator, asyncGenerator }
