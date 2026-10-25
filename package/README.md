# Gradia portable distribution

This folder is built from the Gradia sources. It is not published on npm.

- `min-js/gradia.min.js`: standalone ESM. No dependencies. Exports `GradientRenderer`, `TextureBlendPass`, config helpers and presets.
- `min-js/gradia-react.min.js`: React adapter. Requires your existing React 19+ and the adjacent engine module.
- `types/`: declarations for the direct modules and package exports.

Copy this complete folder into your project, or run `bun add ./path/to/Gradia/package`. For plain JavaScript, copying only `gradia.min.js` is sufficient.

```js
import { GradientRenderer, presets } from "./gradia/min-js/gradia.min.js";
const gradient = new GradientRenderer(canvas, { config: presets[0].config });
// gradient.destroy() only when the canvas is disposed.
```

Full guide: https://gradia.plinka.eu/docs/agents.md
