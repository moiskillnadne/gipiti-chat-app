import Link from "next/link";
import { formatRussianDate } from "@/lib/blog/format";
import type { BlogPostMeta } from "@/lib/blog/types";
import { BlogImage } from "./blog-image";

type PostCardProps = {
  post: BlogPostMeta;
  readingLabel: string;
};

export const PostCard = ({ post, readingLabel }: PostCardProps) => {
  const { frontmatter, slug, readingTimeMinutes } = post;
  const excerpt = frontmatter.excerpt ?? frontmatter.description;

  return (
    <Link className="post-card" href={`/blog/${slug}`}>
      <BlogImage
        alt={frontmatter.title}
        shape="thumb"
        sizes="(max-width: 680px) 100vw, (max-width: 1000px) 50vw, 33vw"
        src={frontmatter.coverImage}
      />
      <div className="pc-body">
        <div className="pc-meta">
          <span className="pc-cat">{frontmatter.category}</span>
          <span>·</span>
          <span>
            {readingTimeMinutes} {readingLabel}
          </span>
        </div>
        <div className="pc-title">{frontmatter.title}</div>
        <p className="pc-excerpt">{excerpt}</p>
        <div className="pc-foot">
          <span>{formatRussianDate(frontmatter.date)}</span>
        </div>
      </div>
    </Link>
  );
};
