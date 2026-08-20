export * from "./glide-goal.js";
export * from "./glide-headroom.js";
export * from "./glide-executor.js";
export * from "./glide-tracer.js";
export * from "./glide-status.js";
export * from "./glide-permissions.js";
export * from "./glide-indepth.js";
export * from "./glide-trace.js";
export * from "./glide-plan.js";
export * from "./glide-build.js";
export * from "./glide-test-tools.js";
export * from "./glide-review.js";
export * from "./glide-ship.js";
export * from "./glide-converge.js";
export * from "./glide-gates.js";
export * from "./glide-graph.js";
export * from "./glide-web-search.js";
export * from "./glide-dashboard.js";
export * from "./glide-icm.js";

import { GlideTool } from "./types.js";
import { glideGoalSetTool } from "./glide-goal.js";
import { glideGoalGetTool } from "./glide-goal.js";
import { glideHeadroomTool } from "./glide-headroom.js";
import { glideExecutorTool } from "./glide-executor.js";
import { glideTracerTool } from "./glide-tracer.js";
import { glideStatusTool } from "./glide-status.js";
import { glidePermissionsTool } from "./glide-permissions.js";
import { glideIndepthTool } from "./glide-indepth.js";
import { glideTraceTool } from "./glide-trace.js";
import { glidePlanTool } from "./glide-plan.js";
import { glideBuildTool } from "./glide-build.js";
import { glideTestTool } from "./glide-test-tools.js";
import { glideReviewTool } from "./glide-review.js";
import { glideShipTool } from "./glide-ship.js";
import { glideConvergeTool } from "./glide-converge.js";
import { glideGatesTool } from "./glide-gates.js";
import { glideGraphTool } from "./glide-graph.js";
import { glideWebSearchTool } from "./glide-web-search.js";
import { glideDashboardTool } from "./glide-dashboard.js";
import { glideIcmTool } from "./glide-icm.js";

export const tools: GlideTool[] = [
  glideGoalSetTool,
  glideGoalGetTool,
  glideHeadroomTool,
  glideExecutorTool,
  glideTracerTool,
  glideStatusTool,
  glidePermissionsTool,
  glideIndepthTool,
  glideTraceTool,
  glidePlanTool,
  glideBuildTool,
  glideTestTool,
  glideReviewTool,
  glideShipTool,
  glideConvergeTool,
  glideGatesTool,
  glideGraphTool,
  glideWebSearchTool,
  glideDashboardTool,
  glideIcmTool,
];
