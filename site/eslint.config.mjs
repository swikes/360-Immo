import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Fichiers que la vérification du code ne lit pas (remplace la liste d'eslint-config-next).
  globalIgnores([
    // Ceux qu'eslint-config-next ignore d'office :
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Rapports des tests automatiques (fichiers générés)
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
