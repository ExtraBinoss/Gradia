# Integrating Gradia

The Code dialog exports the full configuration currently shown by the studio, including palette order, shader style, effects and loop duration. React and JavaScript exports do not silently change the preset. JSON is a versioned `{ "version": 1, "config": ... }` document.

## Choose a distribution

| Option                     | Copy                                                           | Imports                                                         | Dependencies               |
| -------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------- |
| Plain JavaScript, prebuilt | `gradia/min-js/gradia.min.js`                                  | `GradientRenderer`, core utilities, presets, `TextureBlendPass` | None                       |
| React, prebuilt            | Full `gradia/` folder from the kit                             | `gradia-react.min.js` and `gradia.min.js`                       | React 19+                  |
| TypeScript sources         | `gradient/core`, `gradient/webgl`, optionally `gradient/react` | Relative imports                                                | React only for the adapter |
| Local package installation | `bun add ./path/to/Gradia/package`                             | `@plinka/gradia`, `@plinka/gradia/react`                        | React only for the adapter |

The full prebuilt folder includes declarations. If you copy only the minified `.js`, it still works in plain JavaScript. Do not copy only a declaration shim without its sibling `types/` folder. No npm registry publication is assumed.

## React

```tsx
"use client";
import { Gradient } from "./gradia/min-js/gradia-react.min.js";
import { presets } from "./gradia/min-js/gradia.min.js";

export function Hero() {
  return (
    <Gradient
      config={presets[0].config}
      transitionDuration={0.65}
      style={{ display: "block", width: "100%", height: 500 }}
    />
  );
}
```

Replace the preset with the complete `config` copied from Code. Mount once. Config changes update the existing renderer. `transitionDuration={0.65}` blends discrete changes; leave it at `0` for a continuous slider or color picker. Cleanup is automatic, including React StrictMode. For Next.js/RSC, keep the consumer in a client component. Importing the module itself does not access the DOM.

Other props: `playing`, `pixelRatio`, `onError`, `onStats` and `rendererRef`. Define the canvas dimensions explicitly. `height: '100%'` needs a parent with a defined height.

## Plain JavaScript

```js
import { GradientRenderer, presets } from "./gradia/min-js/gradia.min.js";

const canvas = document.querySelector("canvas");
const renderer = new GradientRenderer(canvas, { config: presets[0].config });
// Later, in response to a real control or application event:
renderer.update({ brightness: 1.1 });
renderer.transitionTo(presets[4].config, 0.65);
// On teardown, not immediately after mounting:
// renderer.destroy();
```

The Code dialog's JavaScript file creates its own canvas and registers cleanup on `pagehide`, so it can also run directly as a browser module. In a component, use your framework's teardown lifecycle instead.

A direct browser import is available at `https://gradia.plinka.eu/lib/gradia.min.js` with CORS enabled. Vendor the local module for a reproducible production build. The React file uses bare React imports and is intended for a React bundler (or an explicit import map).

## Config and deterministic time

```js
import { deserializeConfig } from "./gradia/min-js/gradia.min.js";
const config = deserializeConfig(await file.text());
renderer.update(config);
renderer.setPlaying(false);
renderer.seek(2.5);
```

`loopDuration` is an integer from 1 to 30 seconds. `speed` is an integer harmonic count; zero freezes the shader. All styles and GPU effects close at the loop boundary. `seek(seconds)`, `time`, `snapshot()`, `setQuality()` and `destroy()` are public APIs. Fixed `width`/`height` options disable auto-resize for exports and thumbnails.

## Blend your own shader outputs

```js
import { TextureBlendPass } from "./gradia/min-js/gradia.min.js";
const blend = new TextureBlendPass(gl);
blend.draw(textureA, textureB, progress, width, height, outputFramebuffer);
// blend.destroy();
```

Both complete input textures must belong to the same WebGL context. Inputs use straight-alpha sRGB colors; blending defaults to linear light with alpha handling. The pass owns its pipeline state and quad/program, not your input textures. Reconfigure GL state for your next pass. `GradientRenderer.transitionTo()` additionally manages live render targets, time, easing, interruptions and lifecycle.

## Copying only the engine

Keep `core/` and `webgl/` together, with the relative imports supplied by the kit. Add `react/` only if needed. Do not copy `apps/web`, its CSS, Jotai atoms, shadcn components or the editor's persistence into a consumer app.

Video encoding is an optional adapter in `gradient/video/`. Install `mediabunny` only when using it. The engine and React adapter do not depend on Mediabunny.
