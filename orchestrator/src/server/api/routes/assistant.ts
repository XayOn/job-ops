import { tmpdir } from "node:os";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { badRequest } from "@infra/errors";
import { asyncRoute, fail, ok } from "@infra/http";
import { getRequestContext } from "@infra/request-context";
import { signToken } from "@server/auth/jwt";
import { type Request, type Response, Router } from "express";
import { z } from "zod";

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(20000) }))
    .min(1)
    .max(50),
});

const t = (n: string) => `mcp__jobops__${n}`;

const RULES = `Hard rules:
- Never apply to or mark as applied any job the user has not approved explicitly, one by one, in this conversation. Never in bulk.
- Use only facts the user confirmed or that come from their own data. Never invent experience, skills, dates or results.
- Never write, ask for or repeat passwords, codes or credentials.
Answer in the user's language.`;

const agents = {
  ofertas: {
    description: "Find, compare and rank the user's job offers.",
    prompt: `Busca y ordena las ofertas del usuario por encaje y rapidez de contratación. Find and rank the user's offers by fit. Explain each choice in one line.\n${RULES}`,
    tools: [t("list_jobs"), t("get_job")],
  },
  candidaturas: {
    description: "Apply to offers the user approved one by one.",
    prompt: `Solo aplicas a ofertas que el usuario aprobó una a una, nunca en bloque. Apply only to offers the user approved individually; mark each as applied and add a note.\n${RULES}`,
    tools: [t("list_jobs"), t("get_job"), t("set_job_status"), t("add_job_note")],
  },
  entrevistas: {
    description: "Likely interview questions and mock interviews for a job.",
    prompt: `Prepara preguntas probables y simula entrevistas para una oferta, una pregunta cada vez. Prepare likely questions and run a mock interview, one question at a time.\n${RULES}`,
    tools: [t("get_job"), t("list_jobs")],
  },
  formacion: {
    description: "Career paths, Moodle courses, enrolment, generated courses and training plans.",
    prompt: `Muestra itinerarios profesionales, cursos y genera cursos para habilidades que faltan; si el usuario lo pide, crea un plan de formación semanal con create_training_plan usando las habilidades que le faltan de un itinerario. Show career paths and courses; enrol, generate a course or create a training plan (create_training_plan, one missing skill per week) only when asked.\n${RULES}`,
    tools: [t("career_paths"), t("enrol_course"), t("generate_course"), t("create_training_plan")],
  },
  redactor: {
    description: "CV text and cover notes from the user's own facts.",
    prompt: `Redacta textos de CV y cartas breves usando solo hechos del CV del usuario o que él confirme; si falta un dato, pregúntalo. Write CV text and cover notes using only facts from the user's CV or confirmed by them; ask when something is missing.\n${RULES}`,
    tools: [t("get_job"), t("career_paths")],
  },
};

const SYSTEM = `You are the Job-Ops assistant for one job seeker. Route each request to the right subagent (ofertas, candidaturas, entrevistas, formacion, redactor) or answer directly when it is simple.\n${RULES}`;

export const assistantRouter = Router();

assistantRouter.post(
  "/chat",
  asyncRoute(async (req: Request, res: Response) => {
    const c = getRequestContext();
    if (!c?.userId || !c.tenantId || !c.username) return fail(res, badRequest("Sign in first"));
    const body = schema.safeParse(req.body);
    if (!body.success) return fail(res, badRequest(body.error.message));
    const { token } = await signToken({
      sub: c.userId,
      userId: c.userId,
      tenantId: c.tenantId,
      username: c.username,
      isSystemAdmin: !!c.isSystemAdmin,
    });
    const prompt = body.data.messages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");
    let text = "";
    for await (const m of query({
      prompt,
      options: {
        systemPrompt: SYSTEM,
        agents,
        tools: ["Agent"],
        allowedTools: ["Agent", "mcp__jobops__*"],
        permissionMode: "dontAsk",
        mcpServers: {
          jobops: {
            type: "http",
            url: `http://localhost:${process.env.PORT ?? 3001}/mcp`,
            headers: { Authorization: `Bearer ${token}` },
          },
        },
        settingSources: [],
        persistSession: false,
        cwd: tmpdir(),
        maxTurns: 30,
      },
    })) {
      if (m.type === "result") text = m.subtype === "success" ? m.result : `Error: ${m.subtype}`;
    }
    ok(res, { text });
  }),
);
