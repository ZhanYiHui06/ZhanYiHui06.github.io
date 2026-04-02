import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://zhanyihui06.github.io',
  integrations: [mdx(), tailwind()],
  markdown: {
    shikiConfig: {
      theme: 'github-light',
      langs: ['javascript', 'typescript', 'jsx', 'tsx', 'html', 'css', 'json', 'markdown', 'bash', 'python', 'java', 'c', 'cpp', 'rust', 'go'],
      wrap: false,
    },
  },
});
