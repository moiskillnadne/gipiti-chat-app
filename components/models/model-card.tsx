import { providerLogos } from "@/components/icons/logos";
import type { CatalogModel } from "@/lib/marketing/models-catalog";
import { catalogSections } from "@/lib/marketing/models-catalog";

const categoryLabel = (model: CatalogModel): string =>
  catalogSections.find((section) => section.id === model.category)
    ?.categoryLabel ?? "";

export const ModelCard = ({ model }: { model: CatalogModel }) => {
  const ProviderLogo = providerLogos[model.provider];

  return (
    <article className="hover:-translate-y-0.5 flex flex-col gap-3.5 rounded-[18px] border border-zinc-800 bg-zinc-900/55 p-6 transition-[border-color,transform] duration-150 hover:border-indigo-500/45">
      <div className="flex items-center gap-3.5">
        <div
          aria-hidden="true"
          className="flex size-[46px] flex-none items-center justify-center rounded-[13px] border border-white/10 text-white"
          style={{
            background: `linear-gradient(135deg, oklch(0.42 0.11 ${model.hue}), oklch(0.24 0.06 ${model.hue + 40}))`,
          }}
        >
          <ProviderLogo size={22} />
        </div>
        <div>
          <h3 className="mb-0.5 font-semibold text-[17px] text-white">
            {model.name}
          </h3>
          <span className="text-xs text-zinc-500">
            {model.vendor} · {categoryLabel(model)}
          </span>
        </div>
        {model.tag ? (
          <span className="ml-auto self-start rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 font-medium text-[11.5px] text-indigo-300">
            {model.tag}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed">
        {model.description}
      </p>
    </article>
  );
};
