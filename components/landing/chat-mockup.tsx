"use client";

import { motion } from "framer-motion";
import { GlobeIcon } from "lucide-react";
import Image from "next/image";

import { PdfIcon } from "@/components/icons";

type MockAttachment = {
  name: string;
  contentType: string;
};

type MockToolCall = {
  type: "webSearch";
  query: string;
  domains: string[];
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  model?: string;
  attachment?: MockAttachment;
  imageUrl?: string;
  toolCalls?: MockToolCall[];
};

type ChatMockupProps = {
  messages?: ChatMessage[];
  modelBadge?: string;
};

const defaultMessages: ChatMessage[] = [
  {
    role: "user",
    content: "Напиши краткое описание квантовых компьютеров",
  },
  {
    role: "assistant",
    content:
      "Квантовые компьютеры используют кубиты вместо классических битов. Благодаря суперпозиции и квантовой запутанности они способны решать задачи, недоступные обычным компьютерам: моделирование молекул, криптографию и оптимизацию.",
    model: "ChatGPT 5.2",
  },
];

const easing = [0.21, 0.47, 0.32, 0.98];

export const ChatMockup = ({
  messages = defaultMessages,
  modelBadge = "ChatGPT 5.2",
}: ChatMockupProps) => (
  <motion.div
    className="mx-auto w-full max-w-2xl"
    initial={{ opacity: 0, y: 40, scale: 0.95 }}
    transition={{ duration: 0.8, delay: 0.4, ease: easing }}
    viewport={{ once: true, margin: "-50px" }}
    whileInView={{ opacity: 1, y: 0, scale: 1 }}
  >
    <div className="overflow-hidden rounded-xl border border-zinc-700/50 bg-zinc-900/80 shadow-2xl shadow-indigo-500/10 backdrop-blur-sm">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-zinc-700/50 border-b px-4 py-3">
        <div className="flex gap-1.5">
          <div className="size-3 rounded-full bg-zinc-600" />
          <div className="size-3 rounded-full bg-zinc-600" />
          <div className="size-3 rounded-full bg-zinc-600" />
        </div>
        <div className="mx-auto flex items-center gap-2 rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-500">
          <span>gipiti.ru/chat</span>
        </div>
        <div className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-indigo-300 text-xs">
          {modelBadge}
        </div>
      </div>

      {/* Chat messages */}
      <div className="space-y-4 p-4">
        {messages.map((msg) => (
          <motion.div
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            initial={{ opacity: 0, y: 10 }}
            key={msg.content.slice(0, 20)}
            transition={{ duration: 0.5, ease: easing }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-500/20 text-indigo-100"
                  : "bg-zinc-800 text-zinc-300"
              }`}
            >
              {msg.attachment && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-indigo-400/20 bg-indigo-500/10 px-3 py-2">
                  <PdfIcon size={20} />
                  <span className="truncate text-indigo-200 text-xs">
                    {msg.attachment.name}
                  </span>
                </div>
              )}

              {msg.toolCalls?.map((tool) => (
                <div className="mb-3" key={tool.query}>
                  <div className="mb-2 flex items-center gap-2 text-sm text-zinc-400">
                    <GlobeIcon className="size-4 shrink-0" />
                    <span>Поиск: {tool.query}</span>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {tool.domains.map((domain) => (
                      <span
                        className="rounded-full bg-zinc-700/50 px-2.5 py-1 text-xs text-zinc-400"
                        key={domain}
                      >
                        {domain}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {msg.content}
              {msg.model && (
                <div className="mt-2 text-xs text-zinc-500">{msg.model}</div>
              )}

              {msg.imageUrl === "placeholder" ? (
                <div className="mt-3 flex aspect-video w-full items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500">
                  <span className="text-sm text-white/60">AI Generated</span>
                </div>
              ) : msg.imageUrl ? (
                <div className="mt-3 overflow-hidden rounded-lg">
                  <Image
                    alt="Generated image"
                    className="w-full rounded-lg"
                    height={500}
                    src={msg.imageUrl}
                    width={500}
                  />
                </div>
              ) : null}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Input bar */}
      <div className="border-zinc-700/50 border-t p-3">
        <div className="flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5">
          <span className="text-sm text-zinc-500">Напишите сообщение...</span>
          <div className="ml-auto size-8 rounded-lg bg-indigo-500/30" />
        </div>
      </div>
    </div>
  </motion.div>
);
