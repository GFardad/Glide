import eslint from "@eslint/js";
import tslint from "typescript-eslint";

export default tslint.config(
  eslint.configs.recommended,
  ...tslint.configs.recommended,
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "**/*.js",
      "**/*.cjs",
      "**/*.mjs",
      ".dependency-cruiser.js",
      ".prettierrc.cjs",
      "packages/**/dist/**",
      "plugins/**/dist/**",
    ],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser: tslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        process: "readonly",
        console: "readonly",
      },
    },
  }
);
