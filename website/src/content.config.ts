import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

export const collections = {
  guides: defineCollection({
    loader: glob({ pattern: "*.md", base: "../guides" }),
  }),
};
