# Gradia guide for AI agents

Gradia is a portable WebGL gradient engine plus a separate visual editor. Live app: https://gradia.plinka.eu. Repository: https://github.com/ExtraBinoss/Gradia.

## Integrate, do not rebuild the studio

1. Read [integration.md](integration.md) and [architecture.md](architecture.md).
2. Obtain `gradia-kit.zip` from the live app, or use this repository's generated `package/`.
3. Prefer the prebuilt distribution when the consumer does not need engine changes. Copy the kit's complete `gradia/` folder into the consumer, including `min-js/` and `types/`. For JS alone, the single `gradia.min.js` is sufficient.
4. For React, import `Gradient` from `gradia/min-js/gradia-react.min.js`. React 19+ is the only peer. For JS, import `GradientRenderer` from `gradia/min-js/gradia.min.js`.
5. For editable sources, copy `gradient/core` + `gradient/webgl`; optionally `gradient/react`. Keep their relative imports. Do not copy the editor, Jotai, Motion or shadcn into a consumer just to show a gradient.
6. Use the **entire config supplied by the user**. Preserve palette order, shader style, seed, effects, speed, duration and all composition settings. Do not append example updates that silently change the preset.
7. Provide explicit canvas dimensions. Mount once, update uniforms through `update(patch)`, blend discrete choices through `transitionTo(config, 0.65)`, and destroy only on teardown.
8. Never send RAF/time into React state. Respect reduced motion. Verify the real canvas renders, cleanup works, and a loop closes at `loopDuration`.

The Code dialog can copy a task prompt containing the exact current configuration. Its React/JS/JSON tabs share the editor's validated config.

## Public API

`GradientRenderer(canvas, options)`: `update`, `transitionTo`, `setPlaying`, `setQuality`, `seek`, `time`, `render`, `snapshot`, `destroy`.

`TextureBlendPass(gl)`: reusable composition of two same-context shader output textures; `draw` takes progress and a destination framebuffer. It does not own your inputs.

Core exports include `DEFAULT_CONFIG`, `presets`, `parseConfig`, `serializeConfig`, `deserializeConfig`, `randomizeConfig`, `generateVariations` and history helpers. Modules are SSR-safe to import; construct a renderer only in a browser lifecycle.

## Editing this repository

- Bun, strict TypeScript, React, Jotai and shadcn Base UI are the established stack.
- Preserve the core / WebGL / React / UI boundaries.
- Use small, selected Jotai subscriptions. Do not rerender the palette or inspector on every animation frame.
- All shader styles and effects must remain deterministic and periodic.
- Regenerate the minified distribution and kit with `bun run build`; do not hand-edit generated `.min.js` or declaration files.
- Run `bun run typecheck`, `bun run lint`, `bun run test:coverage`, `bun run build` and relevant `bun run test:e2e` scenarios.
- The studio stays on port 8410. Browser tests use a production preview on 8411.
- Never put Cloudflare or GitHub tokens in app code, config JSON, logs or docs.

## Copyable starter prompt

```text
Integrate Gradia in this project. Read https://gradia.plinka.eu/docs/agents.md.
Use the portable minified distribution from https://gradia.plinka.eu/gradia-kit.zip.
Keep the engine independent of UI. Use the React adapter if this is React,
otherwise GradientRenderer. Set explicit dimensions, mount once, preserve my
entire config, and destroy only on teardown. Do not add demo parameter updates.
Keep animation outside React state and verify actual rendering and cleanup.
Use this exact versioned configuration:
<PASTE THE JSON FROM GRADIA CODE HERE>
```
