import type { NextConfig } from "next";

// Page files are normally any `page.tsx` / `page.ts`. We additionally accept the
// `dev.tsx` extension — but only when we're not building for production. That
// makes `page.dev.tsx` a local-development-only route: `next dev` serves it,
// while `next build` doesn't recognise the file as a page at all, so the route
// (and the server action it imports) never reach the deployed site. See
// `app/[year]/edit/page.dev.tsx`, the local score editor.
const PAGE_EXTENSIONS = ["tsx", "ts", "jsx", "js"];
const DEV_ONLY_PAGE_EXTENSIONS = ["dev.tsx", "dev.ts"];

const nextConfig: NextConfig = {
  pageExtensions:
    process.env.NODE_ENV === "production"
      ? PAGE_EXTENSIONS
      : [...DEV_ONLY_PAGE_EXTENSIONS, ...PAGE_EXTENSIONS],
};

export default nextConfig;
