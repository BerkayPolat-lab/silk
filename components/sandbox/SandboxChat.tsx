"use client";

import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function SandboxChat({ modelSlug }: { modelSlug: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! Ask a question or describe what you want to build. (Sandbox chat is currently ephemeral.)",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const assistantIndexRef = useRef<number>(-1);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, loading]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const content = input.trim();
    if (!content || loading) return;

    setInput("");
    setLoading(true);
    setError(null);

    // Append user message and an empty assistant placeholder.
    setMessages((prev) => {
      const next = [
        ...prev,
        { role: "user" as const, content },
        { role: "assistant" as const, content: "" },
      ];
      assistantIndexRef.current = next.length - 1;
      return next;
    });

    const payload = {
      modelSlug,
      messages: [
        ...messages,
        {
          role: "user",
          content,
        },
      ].slice(-20),
    };

    try {
      const res = await fetch("/api/sandbox/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed with ${res.status}`);
      }

      // Server streams SSE from LiteLLM. Parse OpenAI-style stream events:
      //   data: { "choices": [ { "delta": { "content": "..." } } ] }
      //   data: [DONE]
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.body || !contentType.includes("text/event-stream")) {
        // Fallback: server might return JSON.
        const data = (await res.json().catch(() => null)) as
          | { assistant?: string; message?: string; content?: string }
          | null;
        const assistant =
          data?.assistant ?? data?.message ?? data?.content ?? "";
        setMessages((prev) => {
          const idx = assistantIndexRef.current;
          if (idx < 0 || idx >= prev.length) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], content: assistant };
          return next;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by a blank line.
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice("data:".length).trim();
            if (!data) continue;
            if (data === "[DONE]") {
              setMessages((prev) => {
                const idx = assistantIndexRef.current;
                if (idx < 0 || idx >= prev.length) return prev;
                const next = [...prev];
                next[idx] = { ...next[idx], content: assistantText };
                return next;
              });
              return;
            }

            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };

              const delta = parsed.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length > 0) {
                assistantText += delta;
                setMessages((prev) => {
                  const idx = assistantIndexRef.current;
                  if (idx < 0 || idx >= prev.length) return prev;
                  const next = [...prev];
                  next[idx] = { ...next[idx], content: assistantText };
                  return next;
                });
              }
            } catch {
              // Ignore malformed SSE chunk.
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      // Fill the assistant placeholder with the error message.
      setMessages((prev) => {
        const idx = assistantIndexRef.current;
        if (idx < 0 || idx >= prev.length) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={listRef}
        className="h-[60vh] overflow-auto rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="space-y-3">
          {messages.map((m, idx) => (
            <div
              key={`${m.role}-${idx}`}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Thinking...
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Send
        </button>
      </form>
    </div>
  );
}

