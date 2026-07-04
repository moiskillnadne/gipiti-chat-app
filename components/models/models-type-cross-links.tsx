import Link from "next/link";

import {
  type CatalogCategory,
  catalogSections,
  getModelsByCategory,
  pluralizeModels,
} from "@/lib/marketing/models-catalog";

export const ModelsTypeCrossLinks = ({
  currentCategory,
}: {
  currentCategory: CatalogCategory;
}) => (
  <section className="px-4 pt-10 pb-4">
    <div className="mx-auto max-w-6xl">
      <h2 className="mb-6 font-bold text-[27px] text-white tracking-tight">
        Другие разделы каталога
      </h2>
      <div className="flex flex-wrap gap-3">
        {catalogSections
          .filter((section) => section.id !== currentCategory)
          .map((section) => (
            <Link
              className="flex flex-col gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-4 transition-colors hover:border-indigo-500/45"
              href={`/models/${section.slug}`}
              key={section.id}
            >
              <b className="font-semibold text-[15px] text-white">
                {section.heading}
              </b>
              <span className="text-sm text-zinc-500">
                {pluralizeModels(getModelsByCategory(section.id).length)}
              </span>
            </Link>
          ))}
      </div>
    </div>
  </section>
);
