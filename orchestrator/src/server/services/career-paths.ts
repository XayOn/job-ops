import { getLatestDesignResumeDocument } from "@server/repositories/design-resume";
import { getAllJobs } from "@server/repositories/jobs";
import { createConfiguredLlmService, resolveLlmModel } from "./modelSelection";
import { coursesFor } from "./moodle";

const ESCO = "https://ec.europa.eu/esco/api";

type Link = { href: string; title: string; uri?: string };

const esco = async (path: string, q: Record<string, string>) => {
  const r = await fetch(`${ESCO}/${path}?${new URLSearchParams(q)}`);
  if (!r.ok) throw new Error(`ESCO ${r.status}`);
  return r.json();
};

const uriOf = (l: Link) => l.uri ?? new URL(l.href).searchParams.get("uri") ?? l.href;

const resumeTerms = (resume: any): string[] =>
  (resume?.sections?.skills?.items ?? [])
    .flatMap((s: any) => [s.name, ...(s.keywords ?? [])])
    .filter(Boolean)
    .slice(0, 15);

const positions = (resume: any): string[] =>
  [...new Set((resume?.sections?.experience?.items ?? []).map((e: any) => e.position).filter(Boolean))].slice(0, 6) as string[];

const pickOccupations = async (titles: string[], language: string) => {
  if (!titles.length) return [];
  const found = new Map<string, string>();
  for (const t of titles)
    for (const l of ["en", language])
      for (const o of (await esco("search", { text: t, type: "occupation", limit: "8", language: l }))._embedded
        ?.results ?? [])
        found.set(o.uri, o.title);
  const list = [...found.entries()];
  const llm = await createConfiguredLlmService();
  const r = await llm.callJson<{ picks: number[] }>({
    model: await resolveLlmModel(),
    messages: [
      {
        role: "user",
        content: `Job titles:\n${titles.join("\n")}\n\nESCO occupations:\n${list.map(([, t], i) => `${i}: ${t}`).join("\n")}\n\nReturn the indexes of the occupations that really match these job titles, best first, at most 6. Reply with only JSON: {\"picks\":[3,7]}`,
      },
    ],
    jsonSchema: {
      name: "esco_picks",
      schema: {
        type: "object",
        properties: { picks: { type: "array", items: { type: "integer" } } },
        required: ["picks"],
        additionalProperties: false,
      },
    },
  });
  return r.success ? r.data.picks.map((i) => list[i]).filter(Boolean) : [];
};

const findSkill = async (term: string, language: string) => {
  for (const l of [language, "en"]) {
    const hit = (await esco("search", { text: term, type: "skill", limit: "1", language: l }))
      ._embedded?.results?.[0];
    if (hit) return hit as { uri: string; title: string };
  }
  return null;
};

export async function careerPaths(language = "es", top = 5) {
  const doc = await getLatestDesignResumeDocument();
  const terms = resumeTerms(doc?.resumeJson);
  const skills = (await Promise.all(terms.map((t) => findSkill(t, language)))).filter(
    (s): s is { uri: string; title: string } => !!s,
  );
  const mine = new Set(skills.map((s) => s.uri));
  const tally = new Map<string, { title: string; score: number; via: string[] }>();
  for (const s of skills) {
    const links = (await esco("resource/skill", { uri: s.uri, language }))._links ?? {};
    for (const [rel, w] of [["isEssentialForOccupation", 2], ["isOptionalForOccupation", 1]] as const)
      for (const o of (links[rel] ?? []) as Link[]) {
        const t = tally.get(uriOf(o)) ?? { title: o.title, score: 0, via: [] };
        t.score += w;
        t.via.push(s.title);
        tally.set(uriOf(o), t);
      }
  }
  for (const [uri, title] of await pickOccupations(positions(doc?.resumeJson), language)) {
    const t = tally.get(uri) ?? { title, score: 0, via: [] };
    t.score += 10;
    t.via.push("experiencia");
    tally.set(uri, t);
  }
  const best = [...tally.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, top);
  const jobs = await getAllJobs();
  return Promise.all(
    best.map(async ([uri, o]) => {
      const links = (await esco("resource/occupation", { uri, language }))._links ?? {};
      const missing = ((links.hasEssentialSkill ?? []) as Link[])
        .filter((l) => !mine.has(uriOf(l)))
        .map((l) => l.title);
      const words = o.title.toLowerCase().split(/[\s/]+/).filter((w) => w.length > 4);
      const offers = jobs.filter((j) => words.some((w) => j.title.toLowerCase().includes(w))).length;
      const courses = [
        ...new Map(
          (await Promise.all(missing.slice(0, 3).map(coursesFor))).flat().map((c) => [c.id, c]),
        ).values(),
      ];
      return { uri, title: o.title, score: o.score, matched: [...new Set(o.via)], missing, offers, courses };
    }),
  );
}
