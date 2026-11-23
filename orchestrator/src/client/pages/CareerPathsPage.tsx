import { fetchApi } from "@client/api/core";
import { EmptyState, PageHeader, PageMain } from "@client/components/layout";
import { AlertCircle, CalendarDays, Compass, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Course = { id: number; name: string; url: string };

type Path = {
  uri: string;
  title: string;
  score: number;
  matched: string[];
  missing: string[];
  offers: number;
  courses?: Course[];
};

type Plan = {
  weeks: { week: number; skill: string; start: string; due: string; course: Course | null; enrolled: boolean; task: boolean }[];
  notes: string[];
};

const STEPS = ["Reading your CV…", "Matching ESCO occupations…", "Checking real skill gaps against your jobs…"];

const message = (e: unknown) => String((e as Error)?.message ?? e);

export function CareerPathsPage() {
  const [paths, setPaths] = useState<Path[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [plans, setPlans] = useState<Record<string, Plan>>({});

  const load = useCallback(() => {
    setPaths(null);
    setError(null);
    setElapsed(0);
    fetchApi<Path[]>("/career-paths").then(setPaths, (e) => setError(message(e)));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (paths || error) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [paths, error]);

  const run = async <T,>(key: string, path: string, body: unknown, done: (r: T) => void) => {
    setBusy(key);
    await fetchApi<T>(path, { method: "POST", body: JSON.stringify(body) }).then(done, (e) => toast.error(message(e)));
    setBusy(null);
  };

  return (
    <>
      <PageHeader icon={Compass} title="Career Paths" subtitle="Where your CV leads and what to learn next" />
      <PageMain className="max-w-4xl">
        {error && (
          <EmptyState
            icon={AlertCircle}
            title="Could not load career paths"
            description={error}
            action={<Button onClick={load}>Try again</Button>}
          />
        )}
        {!paths && !error && (
          <>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {STEPS[Math.min(STEPS.length - 1, Math.floor(elapsed / 20))]} {elapsed}s (about a minute)
            </p>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </>
        )}
        {paths?.length === 0 && (
          <EmptyState icon={Compass} title="No career paths yet" description="Import a CV first." />
        )}
        {paths?.map((p) => {
          const plan = plans[p.uri];
          return (
            <Card key={p.uri}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <CardTitle className="text-base">
                  <a href={p.uri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
                    {p.title}
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                </CardTitle>
                <Badge variant="outline">{p.offers} matching jobs</Badge>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {p.matched.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">You have</div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.matched.map((m) => (
                        <Badge key={m} variant="secondary">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {p.missing.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">To learn (click to generate a course)</div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.missing.map((m) => (
                        <Button
                          key={m}
                          variant="outline"
                          size="sm"
                          disabled={!!busy}
                          onClick={() =>
                            run<Course>(`gen:${m}`, "/career-paths/generate-course", { skill: m }, (c) =>
                              window.open(c.url, "_blank"),
                            )
                          }
                        >
                          {busy === `gen:${m}` && <Loader2 className="animate-spin" />}
                          {m}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {!!p.courses?.length && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Courses</div>
                    {p.courses.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3">
                        <a href={c.url} target="_blank" rel="noreferrer" className="hover:underline">
                          {c.name}
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!!busy}
                          onClick={() =>
                            run(`enrol:${c.id}`, "/career-paths/enrol", { courseId: c.id }, () => toast.success("Enrolled"))
                          }
                        >
                          {busy === `enrol:${c.id}` && <Loader2 className="animate-spin" />}
                          Enrol
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {plan && (
                  <div className="space-y-2 rounded-lg border border-border/60 p-3">
                    <div className="text-xs font-medium text-muted-foreground">Training plan</div>
                    {plan.weeks.map((w) => (
                      <div key={w.week} className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Week {w.week}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {w.start} → {w.due}
                        </span>
                        <span className="font-medium">{w.skill}</span>
                        {w.course && (
                          <a href={w.course.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            {w.course.name}
                          </a>
                        )}
                        {w.enrolled && <Badge variant="secondary">Enrolled</Badge>}
                        {w.task && <Badge variant="secondary">Tududi task</Badge>}
                      </div>
                    ))}
                    {plan.notes.map((n) => (
                      <p key={n} className="text-xs text-muted-foreground">
                        {n}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
              {p.missing.length > 0 && (
                <CardFooter>
                  <Button
                    disabled={!!busy}
                    onClick={() =>
                      run<Plan>(`plan:${p.uri}`, "/career-paths/plan", { title: p.title, missing: p.missing }, (r) =>
                        setPlans((s) => ({ ...s, [p.uri]: r })),
                      )
                    }
                  >
                    {busy === `plan:${p.uri}` ? <Loader2 className="animate-spin" /> : <CalendarDays />}
                    {busy === `plan:${p.uri}` ? "Creating plan… (courses may take minutes)" : "Create training plan"}
                  </Button>
                </CardFooter>
              )}
            </Card>
          );
        })}
      </PageMain>
    </>
  );
}
