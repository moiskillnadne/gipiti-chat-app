import { formatRussianDate } from "@/lib/blog/format";
import type { BlogFrontmatter } from "@/lib/blog/schema";
import { ArticleContent } from "./article-content";
import { BlogImage } from "./blog-image";

type ArticleViewProps = {
  frontmatter: BlogFrontmatter;
  content: string;
  readingTimeMinutes: number;
  /** e.g. "мин чтения" */
  readingLabel: string;
};

/**
 * The full article layout (header, byline, cover, body, tags) shared by the
 * production `/blog/[slug]` page and the author preview pane, so the preview is
 * identical to what ships — header chrome included, not just the Markdown body.
 */
export const ArticleView = ({
  frontmatter,
  content,
  readingTimeMinutes,
  readingLabel,
}: ArticleViewProps) => {
  return (
    <article>
      <div className="article-top">
        <div className="article-head">
          <div className="head-kicker">
            <span className="kicker">{frontmatter.category}</span>
          </div>
          <h1 className="article-title">{frontmatter.title}</h1>
          <p className="article-dek">{frontmatter.description}</p>
          <div className="byline">
            <span>{formatRussianDate(frontmatter.date)}</span>
            <span className="byline-sep">·</span>
            <span>
              {readingTimeMinutes} {readingLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="cover">
        <BlogImage
          alt={frontmatter.title}
          shape="cmedia"
          sizes="(max-width: 1000px) 100vw, 1000px"
          src={frontmatter.coverImage}
        />
      </div>

      <div className="article-column">
        <ArticleContent content={content} />
      </div>

      {frontmatter.tags.length > 0 ? (
        <div className="article-tags">
          {frontmatter.tags.map((tag) => (
            <span className="article-tag" key={tag}>
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
};
