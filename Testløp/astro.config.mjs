import { defineConfig } from "astro/config";

const base = process.env.BASE_PATH || "/";
const site = process.env.SITE_URL || "https://example.com";

export default defineConfig({
  site,
  base,
  trailingSlash: "always",
  output: "static"
});
