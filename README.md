## Buildless CJS+ESM+TS+Importmaps for the browser.

```html
<!doctype html>

<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Buildless CJS+ESM+TS+Importmaps for the browser.</title>
  <link rel="stylesheet" href="style.css">
  <script type="importmap">
    {
      "imports": {
        "amaro": "https://esm.sh/amaro",
        "confetti": "https://esm.sh/canvas-confetti@1.6.0",
        "confetti.ts": "https://jsr.io/@adam/confetti/2.0.0/src/confetti/confetti.ts",
        "three": "https://unpkg.com/three@0.174.0/build/three.cjs"
      }
    }
  </script>
</head>

<body>
  <script src="require.js"></script>

  <script>
    // `three` is a CJS module
    const THREE = require('three')
    console.log(THREE)

    // add ESM-to-CJS transform
    const esmToCjs = require('./esm-to-cjs.js')
    require.transforms.push({
      test: m => /\b(?:import|export)\b/.test(m.body),
      transform: m => esmToCjs(m.body, m.name, m.path)
    })

    // `confetti` is an ESM module
    const confetti = require('confetti')
    confetti.default()

    // add TypeScript type-stripping transform
    const amaro = require('amaro') // amaro is an ESM module
    require.transforms.unshift({
      test: m => m.path.endsWith('.ts'),
      transform: m => amaro.transformSync(m.body).code
    })

    // `confetti.ts` is a TypeScript module
    const confettiTs = require('confetti.ts')
    confettiTs.throwConfetti()
  </script>
</body>

</html>
```

## Support me

<a href="https://www.buymeacoffee.com/stagas" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-red.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## License

MIT
