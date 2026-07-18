type ModelLandingSectionHeadProps = {
  title: string;
  sub?: string;
};

export const ModelLandingSectionHead = ({
  title,
  sub,
}: ModelLandingSectionHeadProps) => (
  <div className="mb-11 text-center">
    <h2 className="mb-3.5 font-bold text-3xl text-white tracking-tight md:text-[34px]">
      {title}
    </h2>
    {sub ? (
      <p className="mx-auto max-w-xl text-lg text-zinc-400 leading-relaxed">
        {sub}
      </p>
    ) : null}
  </div>
);
