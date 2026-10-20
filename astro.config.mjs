import { defineConfig } from "astro/config";

// SITE_BASE: sub-path the site is served under. "/" for your own server or a
// <user>.github.io repo; "/<repo>/" for a GitHub Pages project repo.
// The deploy workflow sets it, so you rarely need to touch this.
export default defineConfig({
  base: process.env.SITE_BASE || "/",
  trailingSlash: "ignore",
  build: { inlineStylesheets: "always" },
  devToolbar: { enabled: false },
});
