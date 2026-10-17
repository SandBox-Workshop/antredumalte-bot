import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Configuration ESLint du projet.
 *
 * Le projet est actuellement en migration progressive de JavaScript
 * vers TypeScript. Les deux langages sont donc vérifiés séparément :
 *
 * - les fichiers JavaScript conservent les règles ESLint classiques ;
 * - les fichiers TypeScript utilisent également les règles recommandées
 *   par typescript-eslint.
 *
 * Cette séparation permet de migrer les fichiers progressivement sans
 * imposer immédiatement les règles TypeScript à l'ensemble du code existant.
 */
export default defineConfig(
  /**
   * Fichiers générés ou dépendances qui ne doivent jamais être analysés.
   */
  {
    ignores: [
      "node_modules/**",
      "data/*.sqlite",
      "data/*.sqlite-shm",
      "data/*.sqlite-wal",
    ],
  },

  /**
   * Configuration des fichiers JavaScript existants.
   */
  {
    files: ["**/*.js"],

    extends: [js.configs.recommended],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",

      globals: {
        ...globals.node,
      },
    },

    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },

  /**
   * Configuration des fichiers TypeScript.
   *
   * La règle native `no-unused-vars` est désactivée au profit de sa
   * version TypeScript, capable de comprendre correctement les types,
   * imports de types et autres constructions propres à TypeScript.
   */
  {
    files: ["**/*.ts"],

    extends: [js.configs.recommended, tseslint.configs.recommended],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",

      globals: {
        ...globals.node,
      },
    },

    rules: {
      "no-unused-vars": "off",

      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
);
