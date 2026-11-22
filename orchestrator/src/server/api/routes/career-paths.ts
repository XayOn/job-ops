import { asyncRoute, ok } from "@infra/http";
import { getRequestContext } from "@infra/request-context";
import { listSsoIdentitiesForUser } from "@server/repositories/sso-identities";
import { careerPaths } from "@server/services/career-paths";
import { enrol } from "@server/services/moodle";
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
