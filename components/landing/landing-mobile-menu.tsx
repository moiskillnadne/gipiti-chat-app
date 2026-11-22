"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { isLandingSectionLink } from "@/lib/marketing/landing-links";
import {
  type LandingNavLink,
  landingLoginLink,
  landingNavLinks,
  landingRegisterLink,
} from "@/lib/marketing/landing-nav-links";

// Matches Tailwind's `md`, where the desktop header links take over.
const DESKTOP_NAV_QUERY = "(min-width: 768px)";

const getPrefetch = ({ href }: LandingNavLink): false | undefined =>
  isLandingSectionLink(href) ? false : undefined;

/**
 * Full-screen navigation for the marketing header below `md`. Radix Dialog
 * supplies aria-expanded/aria-controls on the trigger, the focus trap, Escape,
 * the scroll lock and returning focus to the trigger on close.
 */
export const LandingMobileMenu = () => {
  const pathname = usePathname();
  // Remembering where the menu was opened closes it on any route change.
  const [openedOnPath, setOpenedOnPath] = useState<string | null>(null);
  const isOpen = openedOnPath === pathname;

  const handleOpenChange = (shouldOpen: boolean): void => {
    setOpenedOnPath(shouldOpen ? pathname : null);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    // Widening past `md` (rotation, un-zooming) hides the trigger: drop the
    // menu and its scroll lock with it.
    const desktopQuery = window.matchMedia(DESKTOP_NAV_QUERY);
    const closeOnDesktop = (): void => {
      if (desktopQuery.matches) {
        setOpenedOnPath(null);
      }
    };
    closeOnDesktop();
    desktopQuery.addEventListener("change", closeOnDesktop);
    return () => desktopQuery.removeEventListener("change", closeOnDesktop);
  }, [isOpen]);

  return (
    <Dialog.Root onOpenChange={handleOpenChange} open={isOpen}>
      <Dialog.Trigger
        aria-label="Меню"
        className="-mr-2 inline-flex size-11 items-center justify-center rounded-full text-zinc-300 transition-colors hover:text-white md:hidden"
      >
        <Menu aria-hidden="true" className="size-6" />
      </Dialog.Trigger>

      <Dialog.Portal>
        {/* Radix mounts its page scroll lock with the overlay, so it is required. */}
        <Dialog.Overlay className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-zinc-950 data-[state=closed]:animate-out data-[state=open]:animate-in md:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 flex flex-col overflow-y-auto overscroll-contain bg-zinc-950 data-[state=closed]:animate-out data-[state=open]:animate-in md:hidden"
        >
          <Dialog.Title className="sr-only">Навигация по сайту</Dialog.Title>

          <div className="flex items-center justify-between px-4 py-4">
            <Dialog.Close asChild>
              <Link
                className="inline-flex min-h-11 items-center font-bold text-2xl text-white"
                href="/"
                prefetch={false}
              >
                GIPITI
              </Link>
            </Dialog.Close>
            <Dialog.Close
              aria-label="Закрыть меню"
              className="-mr-2 inline-flex size-11 items-center justify-center rounded-full text-zinc-300 transition-colors hover:text-white"
            >
              <X aria-hidden="true" className="size-6" />
            </Dialog.Close>
          </div>

          <nav className="flex flex-1 flex-col px-4 pb-8">
            <ul className="flex flex-col">
              {landingNavLinks.map((link) => (
                <li className="border-zinc-800 border-b" key={link.href}>
                  <Dialog.Close asChild>
                    <Link
                      className="flex min-h-14 items-center font-medium text-lg text-zinc-200 transition-colors hover:text-white"
                      href={link.href}
                      prefetch={getPrefetch(link)}
                    >
                      {link.label}
                    </Link>
                  </Dialog.Close>
                </li>
              ))}
            </ul>

            <div className="mt-auto flex flex-col gap-3 pt-8">
              <Dialog.Close asChild>
                <Link
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-5 font-medium text-base text-white"
                  href={landingRegisterLink.href}
                  prefetch={false}
                >
                  {landingRegisterLink.label}
                </Link>
              </Dialog.Close>
              <Dialog.Close asChild>
                <Link
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-zinc-700 px-5 font-medium text-base text-zinc-200 transition-colors hover:text-white"
                  href={landingLoginLink.href}
                  prefetch={false}
                >
                  {landingLoginLink.label}
                </Link>
              </Dialog.Close>
            </div>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
