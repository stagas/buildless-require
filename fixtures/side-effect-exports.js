// This module has side effects when imported
(function (global) {
  global.sideEffectValue = 42
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global)

// Empty export at the end
export { }
