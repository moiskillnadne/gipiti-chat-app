import Link from "next/link";

export const ModelsCta = () => (
  <section className="px-4 py-16">
    <div className="mx-auto max-w-6xl">
      <div className="relative overflow-hidden rounded-3xl border border-purple-500/35 px-6 pt-16 pb-14 text-center sm:px-12">
        <div
          aria-hidden="true"
          className="-inset-[40%] pointer-events-none absolute bg-[radial-gradient(ellipse_at_50%_0%,rgba(168,85,247,0.22),transparent_55%)]"
        />
        <div className="relative">
          <h2 className="mb-3 font-bold text-3xl text-white tracking-tight md:text-4xl">
            Одна подписка — все модели
          </h2>
          <p className="mx-auto mb-7 max-w-lg text-lg text-zinc-400 leading-relaxed">
            Дарим 200 ₽ каждому новому пользователю — попробуйте любую модель.
            Карта не нужна.
          </p>
          <Link
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-4 font-semibold text-lg text-white shadow-indigo-500/30 shadow-lg transition-shadow hover:shadow-indigo-500/40 hover:shadow-xl"
            href="/register"
          >
            Начать бесплатно
          </Link>
          <p className="mt-5 text-sm text-zinc-500">
            Без VPN · Оплата в рублях · Отмена в любой момент
          </p>
        </div>
      </div>
    </div>
  </section>
);
