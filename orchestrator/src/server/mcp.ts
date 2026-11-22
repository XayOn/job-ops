import * as jobs from "@server/repositories/jobs";
import { careerPaths } from "@server/services/career-paths";
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
    name: "career_paths",
    description: "Occupations my CV leads to (ESCO), with matched and missing skills and how many of my jobs fit.",
    inputSchema: { type: "object", properties: { language: { type: "string" } } },
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

const call = async (name: string, a: Record<string, string>) => {
  if (name === "career_paths") return ok(await careerPaths(a.language ?? "es"));
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
    call(r.params.name, (r.params.arguments ?? {}) as Record<string, string>),
  );
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
  await server.close();
};
