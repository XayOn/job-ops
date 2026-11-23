import { getAllJobs } from "@server/repositories/jobs";
import { getSetting } from "@server/repositories/settings";

const LABELS = { ready: "Apply", in_progress: "Interview" } as const;

export async function tududi() {
  const [url, token, project] = await Promise.all([
    getSetting("tududiUrl"),
    getSetting("tududiToken"),
    getSetting("tududiProjectId"),
  ]);
  if (!url || !token) return null;
  const api = `${url.replace(/\/+$/, "")}/api/v1`;
  const call = async (path: string, init?: RequestInit) => {
    const res = await fetch(api + path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) throw new Error(`Tududi ${res.status} on ${path}`);
    return res.json();
  };
  const names = async (): Promise<string[]> =>
    (await call("/tasks?type=all&status=all")).tasks.map((t: { name: string }) => t.name);
  const create = (task: Record<string, unknown>) =>
    call("/task", {
      method: "POST",
      body: JSON.stringify({ ...task, ...(project ? { project_id: Number(project) } : {}) }),
    });
  return { names, create };
}

export async function syncTududi() {
  const t = await tududi();
  if (!t) throw new Error("Tududi is not configured");
  const existing = new Set<string>(
    (await t.names()).flatMap((n) => n.match(/\[jobops:[^\]]+\]/) ?? []),
  );
  const jobs = await getAllJobs(["ready", "in_progress"]);
  let created = 0;
  for (const job of jobs) {
    const marker = `[jobops:${job.id}]`;
    if (existing.has(marker)) continue;
    await t.create({
      name: `${LABELS[job.status as keyof typeof LABELS]}: ${job.title} - ${job.employer} ${marker}`,
      note: job.jobUrl,
    });
    created++;
  }
  return { created, skipped: jobs.length - created };
}
