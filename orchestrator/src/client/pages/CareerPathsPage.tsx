import { useEffect, useState } from "react";
import { fetchApi } from "@client/api/core";

type Path = {
  uri: string;
  title: string;
  score: number;
  matched: string[];
  missing: string[];
  offers: number;
  courses?: { id: number; name: string; url: string }[];
};

const enrolIn = (courseId: number) =>
  fetchApi("/career-paths/enrol", { method: "POST", body: JSON.stringify({ courseId }) }).then(
    () => alert("Enrolled"),
    (e) => alert(String(e?.message ?? e)),
  );

const generate = (skill: string) =>
  fetchApi<{ url: string }>("/career-paths/generate-course", { method: "POST", body: JSON.stringify({ skill }) }).then(
    (c) => window.open(c.url, "_blank"),
    (e) => alert(String(e?.message ?? e)),
  );

export function CareerPathsPage() {
  const [paths, setPaths] = useState<Path[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApi<Path[]>("/career-paths").then(setPaths, (e) => setError(String(e?.message ?? e)));
  }, []);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">Career paths</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!paths && !error && <p className="text-sm text-muted-foreground">Reading your CV and ESCO…</p>}
      {paths?.length === 0 && <p className="text-sm text-muted-foreground">Import a CV first.</p>}
      {paths?.map((p) => (
        <section key={p.uri} className="space-y-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-baseline justify-between gap-4">
            <a href={p.uri} target="_blank" rel="noreferrer" className="font-medium hover:underline">
              {p.title}
            </a>
            <span className="text-xs text-muted-foreground">{p.offers} matching jobs</span>
          </div>
          <p className="text-sm">
            <span className="text-muted-foreground">You have: </span>
            {p.matched.join(", ")}
          </p>
          {p.missing.length > 0 && (
            <p className="text-sm">
              <span className="text-muted-foreground">Missing: </span>
              {p.missing.slice(0, 8).map((m) => (
                <button key={m} type="button" title="Generate a course" className="mr-2 underline" onClick={() => generate(m)}>
                  {m}
                </button>
              ))}
            </p>
          )}
          {p.courses?.map((c) => (
            <p key={c.id} className="flex items-center gap-3 text-sm">
              <a href={c.url} target="_blank" rel="noreferrer" className="hover:underline">
                {c.name}
              </a>
              <button type="button" className="text-xs underline" onClick={() => enrolIn(c.id)}>
                Enrol
              </button>
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
