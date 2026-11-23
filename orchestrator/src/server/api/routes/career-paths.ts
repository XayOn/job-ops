import { asyncRoute, ok } from "@infra/http";
import { getRequestContext } from "@infra/request-context";
import { listSsoIdentitiesForUser } from "@server/repositories/sso-identities";
import { careerPaths } from "@server/services/career-paths";
import { generateCourse } from "@server/services/course-generator";
import { enrol } from "@server/services/moodle";
import { trainingPlan } from "@server/services/training-plan";
import type { Request, Response } from "express";
import { Router } from "express";

export const careerPathsRouter = Router();

careerPathsRouter.get(
  "/",
  asyncRoute(async (req: Request, res: Response) => {
    ok(res, await careerPaths(String(req.query.language ?? "es")));
  }),
);

export const myEmail = async () =>
  (await listSsoIdentitiesForUser(getRequestContext()?.userId ?? "")).find((i) => i.email)?.email ?? null;

careerPathsRouter.post(
  "/enrol",
  asyncRoute(async (req: Request, res: Response) => {
    const email = await myEmail();
    if (!email) throw new Error("No email: sign in with SSO");
    ok(res, await enrol(email, Number(req.body?.courseId)));
  }),
);

careerPathsRouter.post(
  "/generate-course",
  asyncRoute(async (req: Request, res: Response) => {
    ok(res, await generateCourse(String(req.body?.skill), String(req.body?.language ?? "es")));
  }),
);

careerPathsRouter.post(
  "/plan",
  asyncRoute(async (req: Request, res: Response) => {
    const missing = Array.isArray(req.body?.missing) ? req.body.missing.map(String) : [];
    ok(res, await trainingPlan(String(req.body?.title ?? ""), missing, await myEmail(), String(req.body?.language ?? "es")));
  }),
);
