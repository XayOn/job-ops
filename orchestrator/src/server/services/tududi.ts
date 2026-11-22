import { getAllJobs } from "@server/repositories/jobs";
import { getSetting } from "@server/repositories/settings";

const LABELS = { ready: "Apply", in_progress: "Interview" } as const;

export async function syncTududi() {
  const [url, token, project] = await Promise.all([
    getSetting("tududiUrl"),
    getSetting("tududiToken"),
    getSetting("tududiProjectId"),
  ]);
  if (!url || !token) throw new Error("Tududi is not configured");
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

  const { tasks } = await call("/tasks?type=all&status=all");
  const existing = new Set<string>(
    tasks.flatMap(
      (t: { name: string }) => t.name.match(/\[jobops:[^\]]+\]/) ?? [],
    ),
  );
  const jobs = await getAllJobs(["ready", "in_progress"]);
  let created = 0;
  for (const job of jobs) {
    const marker = `[jobops:${job.id}]`;
    if (existing.has(marker)) continue;
    await call("/task", {
      method: "POST",
      body: JSON.stringify({
        name: `${LABELS[job.status as keyof typeof LABELS]}: ${job.title} - ${job.employer} ${marker}`,
        note: job.jobUrl,
        ...(project ? { project_id: Number(project) } : {}),
      }),
    });
    created++;
  }
  return { created, skipped: jobs.length - created };
}
