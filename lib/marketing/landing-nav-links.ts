export type LandingNavLink = {
  label: string;
  href: string;
};

// Root-relative so the anchors resolve to the landing-page sections from any
// route (e.g. the blog), not only when already on "/".
export const landingNavLinks: readonly LandingNavLink[] = [
  { label: "Модели", href: "/models" },
  { label: "Возможности", href: "/#features" },
  { label: "Тарифы", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
  { label: "Блог", href: "/blog" },
];

export const landingLoginLink: LandingNavLink = {
  label: "Войти",
  href: "/login",
};

// The one "start" action of the marketing site: the header, the mobile menu
// and every start CTA on the landing and the models pages read this label.
export const landingRegisterLink: LandingNavLink = {
  label: "Начать бесплатно",
  href: "/register",
};
