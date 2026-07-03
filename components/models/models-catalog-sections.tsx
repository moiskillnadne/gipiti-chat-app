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
        <div className="mb-6">
          <h2 className="mb-2 font-bold text-[27px] text-white tracking-tight">
            {section.heading}
          </h2>
          <p className="text-[15px] text-zinc-400">{section.intro}</p>
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
