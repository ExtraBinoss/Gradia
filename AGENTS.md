# Gradia

Read `docs/agents.md` before modifying the project or integrating its engine elsewhere.

The engine is independent of the editor. Keep WebGL animation outside React state, and use selected Jotai atoms for editor controls. Use the existing shadcn Base UI components.

Generated `package/min-js/` and `package/types/` are rebuilt by `bun run build`, never hand-edited. Validate with the project scripts described in the README. Keep credentials out of source and logs.
