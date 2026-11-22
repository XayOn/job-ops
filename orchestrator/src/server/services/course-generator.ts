import { createConfiguredLlmService, resolveLlmModel } from "./modelSelection";
import { publishCourse } from "./moodle";

const ask = async <T>(prompt: string, properties: Record<string, unknown>) => {
  const llm = await createConfiguredLlmService();
  for (let i = 0; ; i++) {
  const r = await llm.callJson<T>({
    model: await resolveLlmModel(),
    messages: [{ role: "user", content: prompt }],
    jsonSchema: {
      name: "out",
      schema: { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
    },
  });
  if (r.success) return r.data;
  if (i === 2) throw new Error(r.error);
  }
};

export async function generateCourse(skill: string, language = "es") {
  const outline = await ask<{ title: string; summary: string; lessons: string[] }>(
    `Plan a short self-study course in language "${language}" that teaches this skill to an adult job seeker: "${skill}". 4 to 6 lesson titles. Reply with only JSON: {"title":"","summary":"","lessons":[""]}`,
    { title: { type: "string" }, summary: { type: "string" }, lessons: { type: "array", items: { type: "string" } } },
  );
  const lessons = [];
  for (const title of outline.lessons) {
    const { html } = await ask<{ html: string }>(
      `Course "${outline.title}" (language "${language}"). Write the lesson "${title}" as a practical HTML fragment: h2, p, ul, and one exercise at the end. Facts must be correct; say where something depends on the country. Use no double quotes and no backslashes inside the HTML. Reply with only JSON: {"html":""}`,
      { html: { type: "string" } },
    );
    lessons.push({ title, html });
  }
  return publishCourse({ title: outline.title, summary: outline.summary, lessons });
}
