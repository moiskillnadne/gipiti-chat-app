import Link from "next/link";

import {
  catalogSections,
  getModelsByCategory,
} from "@/lib/marketing/models-catalog";

import { ModelCard } from "./model-card";

export const ModelsCatalogSections = () => (
  <div className="mx-auto max-w-6xl px-4 pb-6">
    {catalogSections.map((section) => (
      <section
        className="scroll-mt-24 pt-14 pb-2"
        id={section.id}
        key={section.id}
      >
        <div className="mb-6 flex flex-col items-start gap-2.5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div>
            <h2 className="mb-2 font-bold text-[27px] text-white tracking-tight">
              {section.heading}
            </h2>
            <p className="text-[15px] text-zinc-400">{section.intro}</p>
          </div>
          <Link
            className="flex-none pb-0.5 font-medium text-indigo-300 text-sm transition-colors hover:text-indigo-200"
            href={`/models/${section.slug}`}
          >
            Все модели раздела <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {getModelsByCategory(section.id).map((model) => (
            <ModelCard key={model.modelId} model={model} />
          ))}
        </div>
      </section>
    ))}
  </div>
);
