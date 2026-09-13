import { SparklesIcon } from "lucide-react";
import Image from "next/image";
import { preload } from "react-dom";

import { HERO_POSTER_SRC } from "@/lib/marketing/hero-media";

import { ChatMockup } from "./chat-mockup";
import { HeroVideo } from "./hero-video";

const profilePhotos = [
  "/images/profile-photo-1.jpeg",
  "/images/profile-photo-2.jpeg",
  "/images/profile-photo-3.jpeg",
  "/images/profile-photo-4.jpeg",
];

export const HeroSection = () => {
  preload(HERO_POSTER_SRC, { as: "image", fetchPriority: "high" });

  return (
    <section className="relative overflow-hidden px-4 pt-32 pb-20">
      <HeroVideo />

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Bottom fade for smooth transition to next section */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-zinc-950" />

      {/* Decorative layers */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />

      <div className="relative z-10 mx-auto max-w-5xl text-center">
        {/* Animated badge */}
        <div className="animate-landing-rise">
          <div className="mb-6 inline-flex animate-shimmer items-center gap-2 rounded-full border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 px-4 py-2 text-indigo-300 text-sm">
            <SparklesIcon className="size-4" />
            <span>Дарим 200 ₽ каждому новому пользователю</span>
          </div>
        </div>

        {/* Headline — LCP element, painted with the first frame */}
        <h1 className="mb-6 font-bold text-5xl leading-tight md:text-7xl">
          <span className="text-white">Все лучшие AI-модели</span>
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            в одном месте
          </span>
        </h1>

        {/* Subtitle */}
        <div className="animate-landing-rise [--landing-rise-delay:100ms]">
          <p className="mx-auto mb-10 max-w-2xl text-lg text-zinc-400 md:text-xl">
            GIPITI — единая платформа для общения с передовыми AI-моделями.
            Генерируйте текст, изображения и видео, анализируйте документы.
          </p>
        </div>

        {/* Dual CTAs */}
        <div className="animate-landing-rise [--landing-rise-delay:200ms]">
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-4 font-semibold text-lg text-white shadow-indigo-500/25 shadow-lg transition-all hover:shadow-indigo-500/30 hover:shadow-xl sm:w-auto"
              href="#pricing"
            >
              Посмотреть тарифы
            </a>
          </div>
        </div>

        {/* Social proof */}
        <div className="animate-landing-rise [--landing-rise-delay:300ms]">
          <div className="mt-10 flex items-center justify-center gap-3">
            <div className="-space-x-2 flex">
              {profilePhotos.map((src, index) => (
                <Image
                  alt={`Пользователь GIPITI ${index + 1}`}
                  className="rounded-full border-2 border-zinc-950 object-cover"
                  height={32}
                  key={src}
                  src={src}
                  width={32}
                />
              ))}
            </div>
            <span className="text-sm text-zinc-500">
              Более 500 пользователей уже используют GIPITI
            </span>
          </div>
        </div>

        {/* Chat mockup */}
        <div className="mt-16">
          <ChatMockup />
        </div>
      </div>
    </section>
  );
};
