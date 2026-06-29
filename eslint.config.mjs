import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // supabase/functions are Deno (esm.sh imports, .ts specifiers) — not part of
    // the Next build, mirroring /supabase in .vercelignore.
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "supabase/**"],
  },
];

export default eslintConfig;
