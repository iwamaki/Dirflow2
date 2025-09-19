import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      ecmaVersion: 'latest',
      sourceType: "module",
    },
    ignores: ['docs/'],
  },
  pluginJs.configs.recommended,
];
