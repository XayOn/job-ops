import { type FormEvent, useState } from "react";
import { fetchApi } from "@client/api/core";

type Message = { role: "user" | "assistant"; content: string };

export function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || busy) return;
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    const reply = await fetchApi<{ text: string }>("/assistant/chat", {
      method: "POST",
      body: JSON.stringify({ messages: next }),
    }).then(
      (r) => r.text,
      (err) => `Error: ${String(err?.message ?? err)}`,
    );
    setMessages([...next, { role: "assistant", content: reply }]);
    setBusy(false);
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">Assistant</h1>
      {messages.map((m, i) => (
        <div
          key={i}
          className={`whitespace-pre-wrap rounded-lg border border-border p-3 text-sm ${m.role === "user" ? "self-end bg-muted" : "bg-card"}`}
        >
          {m.content}
        </div>
      ))}
      {busy && <p className="text-sm text-muted-foreground">Thinking…</p>}
      <form onSubmit={send} className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(e)}
          rows={2}
          className="flex-1 rounded-md border border-border bg-background p-2 text-sm"
          placeholder="Ask about your jobs, applications, interviews or courses"
        />
        <button type="submit" disabled={busy} className="rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">
          Send
        </button>
      </form>
    </main>
  );
}
