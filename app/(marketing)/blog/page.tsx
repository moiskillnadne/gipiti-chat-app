import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogIndex } from "@/components/blog/blog-index";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { IS_BLOG_INDEX_ENABLED } from "@/lib/blog/config";
import { getAllPublishedPosts } from "@/lib/blog/posts";

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: {
    absolute: "Блог GIPITI — статьи о моделях, продукте и инженерии",
  },
  description:
    "Запуски моделей, инженерные разборы и гайды по работе с нейросетями — из первых рук от команды GIPITI.",
  alternates: { canonical: "https://gipiti.ru/blog" },
  openGraph: {
    type: "website",
    title: "Блог GIPITI",
    description:
      "Запуски моделей, инженерные разборы и гайды по работе с нейросетями от команды GIPITI.",
    url: "https://gipiti.ru/blog",
  },
};

export default async function BlogIndexPage() {
  // Manually gated until there are enough articles to launch the list page.
  if (!IS_BLOG_INDEX_ENABLED) {
    notFound();
  }

  const posts = await getAllPublishedPosts();

  return (
    <>
      <LandingNav />
      <main>
        <BlogIndex posts={posts} />
      </main>
      <LandingFooter />
    </>
  );
}
