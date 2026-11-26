import * as jobs from "@server/repositories/jobs";
import { myEmail } from "@server/api/routes/career-paths";
import { careerPaths } from "@server/services/career-paths";
import { generateCourse } from "@server/services/course-generator";
import { enrol } from "@server/services/moodle";
import { trainingPlan } from "@server/services/training-plan";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { JobStatus } from "@shared/types";
import type { RequestHandler } from "express";

const STATUSES: JobStatus[] = [
  "discovered",
  "processing",
  "ready",
  "applied",
  "in_progress",
  "skipped",
  "expired",
];

const TOOLS = [
  {
    name: "run_search",
    description:
      "Start a job search in the background (JobSpy: LinkedIn, Indeed, ...), score the results against my CV and save them. Poll search_status, then list_jobs.",
    inputSchema: {
      type: "object",
      properties: {
        searchTerms: { type: "array", items: { type: "string" } },
        country: { type: "string", description: "e.g. spain" },
        cityLocations: { type: "array", items: { type: "string" } },
        workplaceTypes: { type: "array", items: { type: "string", enum: ["remote", "hybrid", "onsite"] } },
        sources: { type: "array", items: { type: "string" } },
        topN: { type: "number" },
      },
    },
  },
  {
    name: "search_status",
    description: "Whether a job search is running and how the last one went.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "import_job",
    description:
      "Add a job found elsewhere to my workspace; it is scored against my CV. Check list_jobs first to avoid duplicates.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        employer: { type: "string" },
        jobUrl: { type: "string" },
        jobDescription: { type: "string" },
        location: { type: "string" },
        salary: { type: "string" },
        deadline: { type: "string" },
        sourceJobId: { type: "string" },
      },
      required: ["title", "employer", "jobUrl", "jobDescription"],
    },
  },
  {
    name: "career_paths",
    description: "Occupations my CV leads to (ESCO), with matched and missing skills and how many of my jobs fit.",
    inputSchema: { type: "object", properties: { language: { type: "string" } } },
  },
  {
    name: "enrol_course",
    description: "Enrol me in a Moodle course from my career paths.",
    inputSchema: { type: "object", properties: { courseId: { type: "number" } }, required: ["courseId"] },
  },
  {
    name: "generate_course",
    description: "Generate a self-study course for a missing skill and publish it in Moodle.",
    inputSchema: { type: "object", properties: { skill: { type: "string" }, language: { type: "string" } }, required: ["skill"] },
  },
  {
    name: "create_training_plan",
    description:
      "Create a week-by-week training plan for a career path: one missing skill per week from next Monday, reusing or generating a Moodle course, enrolling me, and adding Tududi tasks if configured.",
    inputSchema: {
      type: "object",
      properties: { title: { type: "string" }, missing: { type: "array", items: { type: "string" } }, language: { type: "string" } },
      required: ["title", "missing"],
    },
  },
  {
    name: "list_jobs",
    description: "List my jobs, optionally filtered by status.",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string", enum: STATUSES } },
    },
  },
  {
    name: "get_job",
    description: "Get one of my jobs by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "set_job_status",
    description: "Change the status of one of my jobs.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: STATUSES },
      },
      required: ["id", "status"],
    },
  },
  {
    name: "add_job_note",
    description: "Add a note to one of my jobs.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
      },
      required: ["id", "title", "content"],
    },
  },
];

const ok = (data: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(data) }],
});

const brief = (j: Awaited<ReturnType<typeof jobs.getJobById>>) =>
  j && {
    id: j.id,
    title: j.title,
    employer: j.employer,
    location: j.location,
    status: j.status,
    score: j.suitabilityScore,
    url: j.jobUrl,
  };

const self = async (auth: string | undefined, path: string, body?: unknown) => {
  const r = await fetch(`http://127.0.0.1:${process.env.PORT ?? 3001}/api${path}`, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return ok(await r.json());
};

const call = async (name: string, a: Record<string, any>, auth?: string) => {
  if (name === "run_search") return self(auth, "/pipeline/run", a);
  if (name === "search_status") return self(auth, "/pipeline/status");
  if (name === "import_job") return self(auth, "/manual-jobs/import", { job: { source: "mcp", ...a } });
  if (name === "career_paths") return ok(await careerPaths(a.language ?? "es"));
  if (name === "enrol_course") {
    const email = await myEmail();
    if (!email) throw new Error("No email: sign in with SSO");
    return ok(await enrol(email, Number(a.courseId)));
  }
  if (name === "generate_course") return ok(await generateCourse(a.skill, a.language ?? "es"));
  if (name === "create_training_plan")
    return ok(await trainingPlan(a.title, (a.missing ?? []).map(String), await myEmail(), a.language ?? "es"));
  if (name === "list_jobs")
    return ok((await jobs.getAllJobs(a.status ? [a.status as JobStatus] : undefined)).map(brief));
  if (name === "get_job") return ok(await jobs.getJobById(a.id));
  if (name === "set_job_status")
    return ok(brief(await jobs.updateJob(a.id, { status: a.status as JobStatus })));
  if (name === "add_job_note")
    return ok(await jobs.createJobNote({ jobId: a.id, title: a.title, content: a.content }));
  throw new Error(`unknown tool ${name}`);
};

export const mcpHandler: RequestHandler = async (req, res) => {
  const server = new Server({ name: "jobops", version: "1" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, (r) =>
    call(r.params.name, (r.params.arguments ?? {}) as Record<string, string>, req.headers.authorization),
  );
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
  await server.close();
};
