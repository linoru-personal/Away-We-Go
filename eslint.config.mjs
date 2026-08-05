import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /**
       * Raw <img> is the deliberate choice in this app, so the warning is noise.
       *
       * next/image exists to resize images and serve modern formats. Both are
       * already done at upload time: `app/api/trips/[tripId]/photos/route.ts`
       * uses sharp to write WebP q85 at 300px (thumb) and 1600px (display), and
       * covers/avatars are cropped to the fixed sizes in `lib/image-presets.ts`.
       *
       * next/image would also cost money to make things slightly worse: Storage
       * URLs are signed with a 1-hour expiry, so the optimizer's cache key
       * rotates and Vercel bills a fresh transformation each time — to re-encode
       * already-optimal WebP.
       *
       * Lazy loading, the one thing that was genuinely missing, is handled with
       * `loading="lazy"` on images in scrollable collections. See
       * docs/superpowers/specs/2026-08-05-lazy-load-images-design.md.
       */
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
