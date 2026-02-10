"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { type ChatMessage, ChatMockup } from "./chat-mockup";
import { FadeIn } from "./fade-in";

type DemoTab = {
  id: string;
  label: string;
  messages: ChatMessage[];
  modelBadge: string;
};

const demoTabs: DemoTab[] = [
  {
    id: "writing",
    label: "Написание текста",
    modelBadge: "ChatGPT 5.2",
    messages: [
      {
        role: "user",
        content: "Напиши продающий текст для лендинга AI-платформы",
      },
      {
        role: "assistant",
        content:
          "Откройте для себя мощь искусственного интеллекта нового поколения. Наша платформа объединяет лучшие языковые модели в едином интерфейсе, позволяя вам создавать контент, анализировать данные и решать сложные задачи за считанные секунды.",
        model: "ChatGPT 5.2",
      },
    ],
  },
  {
    id: "analysis",
    label: "Анализ документов",
    modelBadge: "Claude Opus 4.6",
    messages: [
      {
        role: "user",
        content: "Проанализируй этот контракт и найди ключевые условия",
        attachment: {
          name: "Договор_поставки_2025.pdf",
          contentType: "application/pdf",
        },
      },
      {
        role: "assistant",
        content:
          "Я проанализировал документ. Ключевые условия: срок действия — 12 месяцев с автопродлением, неустойка 0.1% за день просрочки, юрисдикция — арбитражный суд г. Москвы. Рекомендую обратить внимание на пункт 5.3 об ответственности.",
        model: "Claude Opus 4.6",
      },
    ],
  },
  {
    id: "images",
    label: "Генерация изображений",
    modelBadge: "Gemini 3 Pro Nano Banana",
    messages: [
      {
        role: "user",
        content:
          "Создай необычное изображение человека, парящего над цветочным полем",
      },
      {
        role: "assistant",
        content:
          "Вот необычное изображение человека, парящего над цветочным полем:",
        imageUrl: "/images/generated-photo-sample.jpeg",
        model: "Gemini 3 Pro Nano Banana",
      },
    ],
  },
  {
    id: "search",
    label: "Поиск в интернете",
    modelBadge: "Grok 4.1",
    messages: [
      {
        role: "user",
        content: "Какие новости в мире AI за последнюю неделю?",
      },
      {
        role: "assistant",
        content:
          "За последнюю неделю: OpenAI представила новую архитектуру GPT-5.2 с улучшенным рассуждением, Google выпустила Gemini 3 с нативной поддержкой мультимодальности, а Anthropic объявила о запуске Claude Opus 4.6 с расширенным контекстным окном.",
        toolCalls: [
          {
            type: "webSearch",
            query: "AI новости за неделю 2025",
            domains: [
              "openai.com",
              "deepmind.google",
              "anthropic.com",
              "reuters.com",
            ],
          },
        ],
        model: "Grok 4.1",
      },
    ],
  },
  {
    id: "code",
    label: "Генерация кода",
    modelBadge: "Claude Opus 4.6",
    messages: [
      {
        role: "user",
        content: "Сгенерируй алгоритм поиска кратчайшего пути",
      },
      {
        role: "assistant",
        content: "Конечно! Вот алгоритм Дейкстры на Python:",
        codeBlock: {
          language: "python",
          code: [
            "import heapq",
            "",
            "def dijkstra(graph, start):",
            "    distances = {node: float('inf') for node in graph}",
            "    distances[start] = 0",
            "    queue = [(0, start)]",
            "",
            "    while queue:",
            "        dist, node = heapq.heappop(queue)",
            "        if dist > distances[node]:",
            "            continue",
            "",
            "        for neighbor, weight in graph[node]:",
            "            new_dist = dist + weight",
            "            if new_dist < distances[neighbor]:",
            "                distances[neighbor] = new_dist",
            "                heapq.heappush(queue, (new_dist, neighbor))",
            "",
            "    return distances",
          ].join("\n"),
        },
        model: "Claude Opus 4.6",
      },
    ],
  },
];

export const DemoShowcaseSection = () => {
  const [activeTab, setActiveTab] = useState(demoTabs[0].id);
  const activeDemo =
    demoTabs.find((tab) => tab.id === activeTab) ?? demoTabs[0];

  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <h2 className="mb-4 text-center font-bold text-3xl text-white md:text-4xl">
            Смотрите в действии
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-zinc-400">
            Выберите сценарий и посмотрите, как GIPITI решает реальные задачи
          </p>
        </FadeIn>

        {/* Tabs */}
        <FadeIn delay={0.2}>
          <div className="relative mb-10 flex flex-wrap justify-center gap-1 rounded-xl bg-zinc-900/50 p-1.5">
            {demoTabs.map((tab) => (
              <button
                className={`relative z-10 rounded-lg px-4 py-2.5 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "text-white"
                    : "text-zinc-400 hover:text-zinc-300"
                }`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {activeTab === tab.id && (
                  <motion.div
                    className="absolute inset-0 rounded-lg bg-zinc-800"
                    layoutId="demo-tab-indicator"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>
        </FadeIn>

        {/* Demo content */}
        <div className="relative">
          {/* Glow behind mockup */}
          <div className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 size-[400px] rounded-full bg-indigo-500/10 blur-3xl" />

          <AnimatePresence mode="wait">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              initial={{ opacity: 0, y: 10 }}
              key={activeTab}
              transition={{ duration: 0.3 }}
            >
              <ChatMockup
                messages={activeDemo.messages}
                modelBadge={activeDemo.modelBadge}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};
