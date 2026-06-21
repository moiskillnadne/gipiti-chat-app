import type { ReactNode } from "react";
import "./article.css";

/**
 * Wraps every `/blog/*` route in `.blog-root` (scopes the dark blog theme tokens)
 * and loads the blog stylesheet. The dark page background is already set by the
 * parent `(marketing)` layout.
 */
export default function BlogLayout({ children }: { children: ReactNode }) {
  return <div className="blog-root">{children}</div>;
}
