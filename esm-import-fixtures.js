// Default import
import defaultValue from './esm-fixtures.js'

// Named imports
import { namedValue, namedObject, namedFunction, NamedClass } from './esm-fixtures.js'

// Renamed imports
import { namedValue as renamedImport } from './esm-fixtures.js'

// Namespace import
import * as esmNamespace from './esm-fixtures.js'

// Multiple imports
import { multipleA, multipleB } from './esm-fixtures.js'

// Mixed default and named imports
import def, { namedValue as val } from './esm-fixtures.js'

// Verify imports
export function verifyImports() {
  return {
    defaultImport: defaultValue === 'default',
    namedImports: {
      value: namedValue === 42,
      object: namedObject.foo === 'bar',
      function: namedFunction() === 'hello',
      class: new NamedClass().method() === 'world'
    },
    renamedImport: renamedImport === 42,
    namespaceImport: {
      hasAll: 'namedValue' in esmNamespace && 'default' in esmNamespace,
      value: esmNamespace.namedValue === 42
    },
    multipleImports: {
      a: multipleA === 1,
      b: multipleB === 2
    },
    mixedImports: {
      default: def === 'default',
      named: val === 42
    }
  }
}
