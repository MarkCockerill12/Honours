import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

export default [
  {
    ignores: ["**/dist/**", "**/build/**", "**/out/**", "**/.next/**", "**/.expo/**", "**/node_modules/**", "**/extension-dist/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.webextensions,
        ...globals.vitest,
        ...globals.jest,
        NodeJS: "readonly",
        chrome: "readonly",
        browser: "readonly",
        console: "readonly",
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        location: "readonly",
        history: "readonly",
        MutationObserver: "readonly",
        ResizeObserver: "readonly",
        Element: "readonly",
        HTMLElement: "readonly",
        NodeFilter: "readonly",
        MouseEvent: "readonly",
        Event: "readonly",
        URL: "readonly",
        Blob: "readonly",
        WebAssembly: "readonly",
        self: "readonly",
        importScripts: "readonly",
        performance: "readonly",
        getComputedStyle: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": ts,
    },
    rules: {
      ...ts.configs.recommended.rules,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["apps/desktop/electron/**/*.js", "apps/extension/scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];
