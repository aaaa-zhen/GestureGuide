import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://interactionguide.cn',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
  devToolbar: {
    enabled: false,
  },
});
