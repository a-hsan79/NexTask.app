export default [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        URLSearchParams: "readonly",
        history: "readonly",
        location: "readonly",
        URL: "readonly",
        fetch: "readonly",
        Promise: "readonly",
        Math: "readonly",
        parseFloat: "readonly",
        Intl: "readonly",
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { "args": "none" }],
      "no-implicit-globals": "warn",
    }
  }
];
