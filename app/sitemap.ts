import type { MetadataRoute } from "next";
import { IS_BLOG_INDEX_ENABLED } from "@/lib/blog/config";
import { getSitemapEntries } from "@/lib/blog/posts";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://gipiti.ru";

  const blogPosts = await getSitemapEntries();
  // The article pages are always indexable; the `/blog` list URL is only listed
  // once the index page is launched.
  const blogIndexEntry: MetadataRoute.Sitemap = IS_BLOG_INDEX_ENABLED
    ? [
        {
          url: `${baseUrl}/blog`,
          changeFrequency: "daily",
          priority: 0.7,
        },
      ]
    : [];
  const blogEntries: MetadataRoute.Sitemap = [
    ...blogIndexEntry,
    ...blogPosts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];

  return [
    {
      url: baseUrl,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/login`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/register`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/legal/offer`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/requisites`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${baseUrl}/legal/support`,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    ...blogEntries,
  ];
}
