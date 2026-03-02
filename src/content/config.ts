import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    category: z.enum(['教程', '洞察', '随笔']),
    excerpt: z.string(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = { posts };
