// This module has side effects when imported
globalThis.sideEffectValue = 42

// Empty export at the end to avoid transformation issues
export { }
