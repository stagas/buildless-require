// Simple test runner
function createTestElement(type, name) {
  const el = document.createElement('div')
  el.className = `test-${type}`
  el.innerHTML = `<span class="test-name">${name}</span>`
  return el
}

// Track current test group stack
const groupStack = []

function describe(name, fn) {
  const group = createTestElement('group', name)

  // Find the appropriate parent - use the top-level group if it exists
  const topLevelGroup = groupStack[0]?.element
  const parent = topLevelGroup || document.body
  parent.appendChild(group)

  // Push this group onto stack
  groupStack.push({ element: group, name })

  console.group(name)
  fn()
  console.groupEnd()

  // Pop this group off stack
  groupStack.pop()
}

function it(name, fn) {
  const test = createTestElement('case', name)
  const currentGroup = groupStack[groupStack.length - 1]?.element || document.body
  currentGroup.appendChild(test)

  let result
  try {
    result = fn()
    if (result && typeof result.then === 'function') {
      // Handle async test
      result
        .then(() => {
          test.classList.add('pass')
          test.innerHTML += ' <span class="test-result">✓</span>'
          console.log('✓', name)
        })
        .catch(err => {
          test.classList.add('fail')
          const errMsg = err && err.message ? err.message : String(err)
          test.innerHTML += ` <span class="test-result">✗</span><pre class="test-error">${errMsg}</pre>`
          console.error('✗', name)
          console.error(err)
        })
    } else {
      // Handle sync test
      test.classList.add('pass')
      test.innerHTML += ' <span class="test-result">✓</span>'
      console.log('✓', name)
    }
  } catch (err) {
    test.classList.add('fail')
    const errMsg = err && err.message ? err.message : String(err)
    test.innerHTML += ` <span class="test-result">✗</span><pre class="test-error">${errMsg}</pre>`
    console.error('✗', name)
    console.error(err)
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed')
  }
}

// Add styles to document
const style = document.createElement('style')
style.textContent = `
  body {
    background: #1e1e1e;
    color: #d4d4d4;
    margin: 1em;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .test-group {
    margin: 0.5em;
    padding: 1em;
    border: 1px solid #333;
    border-radius: 4px;
    background: #252526;
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }

  .test-case {
    padding: 0.5em;
    border-radius: 4px;
  }

  .test-case.pass {
    background: #143314;
    color: #4ec94e;
  }

  .test-case.fail {
    background: #331414;
    color: #c94e4e;
  }

  .test-result {
    margin-left: 0.5em;
    font-weight: bold;
  }

  .test-error {
    margin: 0.5em 0;
    padding: 0.5em;
    background: #1e1e1e;
    border: 1px solid #333;
    border-radius: 2px;
    white-space: pre-wrap;
    font-family: monospace;
    color: #c94e4e;
  }

  .test-name {
    color: #d4d4d4;
  }

  .test-group > .test-name {
    font-size: 1.1em;
    margin-bottom: 0.5em;
    display: block;
    color: #9cdcfe;
  }
`
document.head.appendChild(style)

// Export test functions
window.describe = describe
window.it = it
window.assert = assert
