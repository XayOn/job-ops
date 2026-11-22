import { asyncRoute, ok } from "@infra/http";
import { syncTududi } from "@server/services/tududi";
import { Router } from "express";

export const tududiRouter = Router();

tududiRouter.post(
  "/sync",
  asyncRoute(async (_req, res) => {
    ok(res, await syncTududi());
  }),
);
