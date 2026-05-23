/**
 * server/api/publishing.routes.ts
 *
 * Thin combiner — mounts all publishing sub-routers under their paths.
 * Single responsibility: route mounting only. No handler logic.
 */

import { Router }                    from "express";
import { createDeployRouter }        from "./publishing-deploy.routes.ts";
import { createDomainRouter }        from "./publishing-domain.routes.ts";
import { createSettingsRouter }      from "./publishing-settings.routes.ts";
import { createManageRouter }        from "./publishing-manage.routes.ts";

export function createPublishingRouter(): Router {
  const router = Router();
  router.use("/", createDeployRouter());
  router.use("/", createDomainRouter());
  router.use("/", createSettingsRouter());
  router.use("/", createManageRouter());
  return router;
}
