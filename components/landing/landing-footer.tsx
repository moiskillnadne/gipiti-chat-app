"use client";

import Link from "next/link";

const productLinks = [
  { label: "Возможности", href: "#features" },
  { label: "Модели", href: "#models" },
  { label: "Тарифы", href: "#pricing" },
];

const companyLinks = [
  { label: "Оферта", href: "/legal/offer" },
  { label: "Конфиденциальность", href: "/legal/privacy" },
  { label: "Поддержка", href: "/legal/support" },
];

export const LandingFooter = () => (
  <footer className="border-zinc-800 border-t px-4 py-12">
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-8 md:grid-cols-3">
        {/* Brand column */}
        <div>
          <Link className="font-bold text-white text-xl" href="/">
            GIPITI
          </Link>
          <p className="mt-3 max-w-xs text-sm text-zinc-500 leading-relaxed">
            Единая платформа для общения с лучшими AI-моделями. Доступно из
            России, оплата в рублях.
          </p>
          <a
            className="mt-4 inline-flex items-center gap-2 text-indigo-400 text-sm transition-colors hover:text-indigo-300"
            href="#pricing"
          >
            Попробовать бесплатно
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>

        {/* Product column */}
        <div>
          <h4 className="mb-4 font-medium text-sm text-white">Продукт</h4>
          <ul className="space-y-2.5">
            {productLinks.map((link) => (
              <li key={link.href}>
                <a
                  className="text-sm text-zinc-400 transition-colors hover:text-white"
                  href={link.href}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Company column */}
        <div>
          <h4 className="mb-4 font-medium text-sm text-white">Компания</h4>
          <ul className="space-y-2.5">
            {companyLinks.map((link) => (
              <li key={link.href}>
                <Link
                  className="text-sm text-zinc-400 transition-colors hover:text-white"
                  href={link.href}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Copyright */}
      <div className="mt-12 border-zinc-800/50 border-t pt-8 text-center text-sm text-zinc-600">
        &copy; {new Date().getFullYear()} GIPITI. Все права защищены.
      </div>
    </div>
  </footer>
);
