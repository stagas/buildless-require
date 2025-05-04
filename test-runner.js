// Simple test runner
function createTestElement(type, name) {
  const el = document.createElement('div')
  el.className = `test-${type}`
  el.innerHTML = `<span class="test-name">${name}</span>`
  return el
}

function describe(name, fn) {
  const group = createTestElement('group', name)
  document.body.appendChild(group)
  console.group(name)
  fn()
  console.groupEnd()
}

function it(name, fn) {
  const test = createTestElement('case', name)
  const lastGroup = document.querySelector('.test-group:last-child')
  lastGroup.appendChild(test)

  try {
    fn()
    test.classList.add('pass')
    test.innerHTML += ' <span class="test-result">✓</span>'
    console.log('✓', name)
  } catch (err) {
    test.classList.add('fail')
    test.innerHTML += ` <span class="test-result">✗</span><pre class="test-error">${err.message}</pre>`
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
  .test-group {
    margin: 1em;
    padding: 1em;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  .test-case {
    margin: 0.5em 1em;
    padding: 0.5em;
    border-radius: 4px;
  }
  .test-case.pass {
    background: #e6ffe6;
    color: #006600;
  }
  .test-case.fail {
    background: #ffe6e6;
    color: #660000;
  }
  .test-result {
    margin-left: 0.5em;
    font-weight: bold;
  }
  .test-error {
    margin: 0.5em 0;
    padding: 0.5em;
    background: #fff;
    border-radius: 2px;
    white-space: pre-wrap;
    font-family: monospace;
  }
`
document.head.appendChild(style)

// Export test functions
window.describe = describe
window.it = it
window.assert = assert
