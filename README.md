## Buildless CommonJS require and ESM imports mix with importmaps, for the browser.

```html
<!doctype html>

<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>buildless require and ESM imports with importmaps</title>
  <link rel="stylesheet" href="style.css">
  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.174.0/build/three.cjs",
        "confetti": "https://esm.sh/canvas-confetti@1.6.0"
      }
    }
  </script>
</head>

<body>
  <script src="require.js"></script>
  <script>
    const THREE = require('three')
    console.log(THREE)

    const confetti = require('confetti')
    confetti.default()
  </script>
</body>

</html>
```

## Support me

<a href="https://www.buymeacoffee.com/stagas" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-red.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## License

MIT
