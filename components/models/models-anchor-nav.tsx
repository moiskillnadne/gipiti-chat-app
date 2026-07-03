import { catalogSections } from "@/lib/marketing/models-catalog";

export const ModelsAnchorNav = () => (
  <div className="px-4 pt-10">
    <nav
      aria-label="Разделы каталога"
      className="mx-auto flex max-w-6xl flex-wrap gap-2.5"
    >
      {catalogSections.map((section) => (
        <a
          className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/40 px-5 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"
          href={`#${section.id}`}
          key={section.id}
        >
          {section.categoryLabel}
        </a>
      ))}
    </nav>
  </div>
);
