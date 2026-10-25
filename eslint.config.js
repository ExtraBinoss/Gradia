import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
export default [
  {
    ignores: [
      "dist/**",
      "dist-lib/**",
      "coverage/**",
      "node_modules/**",
      "package/**",
      "worker-configuration.d.ts",
      "apps/web/public/lib/**",
      "apps/web/public/types/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: ts.parser },
    plugins: { "react-hooks": hooks },
    rules: hooks.configs["recommended-latest"].rules,
  },
];
