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

// The four catalog sections in the footer. Kept here, not read from
// `models-catalog.ts`, so the client footer does not pull that ~1000-line copy
// into the bundle; a unit test keeps the hrefs in step with `catalogSections`.
export const landingCatalogSectionLinks: readonly LandingNavLink[] = [
  { label: "Нейросети для текста", href: "/models/text" },
  { label: "Нейросети для изображений", href: "/models/image-generation" },
  { label: "Нейросети для видео", href: "/models/video-generation" },
  { label: "Нейросети для кода", href: "/models/code" },
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

// The secondary hero action that scrolls to the pricing block. Singular: there
// is one plan. The nav item keeps the section name «Тарифы».
export const landingPricingLink: LandingNavLink = {
  label: "Посмотреть тариф",
  href: "/#pricing",
};
