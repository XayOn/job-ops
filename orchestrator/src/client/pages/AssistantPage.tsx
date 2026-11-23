import { fetchApi } from "@client/api/core";
import { JobDescriptionMarkdown } from "@client/components/JobDescriptionMarkdown";
import { EmptyState, PageHeader, PageMain, SectionCard } from "@client/components/layout";
import { Bot, Loader2, Send } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

export function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [messages, busy]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
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
    <>
      <PageHeader icon={Bot} title="Assistant" subtitle="Jobs, applications, interviews and training" />
      <PageMain className="max-w-3xl">
        <SectionCard className="flex h-[calc(100vh-12rem)] flex-col gap-4 p-0">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <EmptyState
                icon={Bot}
                title="Ask me anything about your job search"
                description="Rank your offers, prepare an interview, or create a training plan for a career path."
              />
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" && "justify-end")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-4 py-2 text-sm",
                    m.role === "user" ? "whitespace-pre-wrap bg-primary text-primary-foreground" : "bg-muted/50",
                  )}
                >
                  {m.role === "user" ? m.content : <JobDescriptionMarkdown description={m.content} className="prose-sm" />}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking…
              </div>
            )}
            <div ref={end} />
          </div>
          <form onSubmit={send} className="flex items-end gap-2 border-t border-border/60 p-4">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              className="resize-none"
              placeholder="Ask about your jobs, applications, interviews or courses (Shift+Enter for a new line)"
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()}>
              <Send />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </SectionCard>
      </PageMain>
    </>
  );
}
