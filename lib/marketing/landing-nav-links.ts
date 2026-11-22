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

// The mobile menu's primary action.
export const landingRegisterLink: LandingNavLink = {
  label: "Зарегистрироваться",
  href: "/register",
};
