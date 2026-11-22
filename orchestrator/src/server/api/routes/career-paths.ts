import { asyncRoute, ok } from "@infra/http";
import { careerPaths } from "@server/services/career-paths";
import type { Request, Response } from "express";
import { Router } from "express";

export const careerPathsRouter = Router();

careerPathsRouter.get(
  "/",
  asyncRoute(async (req: Request, res: Response) => {
    ok(res, await careerPaths(String(req.query.language ?? "es")));
  }),
);
