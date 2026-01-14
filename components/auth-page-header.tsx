type AuthPageHeaderProps = {
  title: string;
  subtitle: string;
};

export function AuthPageHeader({ title, subtitle }: AuthPageHeaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
      <h3 className="font-semibold text-2xl dark:text-zinc-50">{title}</h3>
      <p className="text-gray-500 text-sm dark:text-zinc-400">{subtitle}</p>
    </div>
  );
}
