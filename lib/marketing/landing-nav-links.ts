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

// The primary action of the header and the mobile menu. Same label as the
// start CTAs on the page, so one action reads one way everywhere.
export const landingRegisterLink: LandingNavLink = {
  label: "Попробовать бесплатно",
  href: "/register",
};
