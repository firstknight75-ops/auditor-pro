import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "../components/route-loading";
import { RouteError } from "../components/route-error";
import { AuditorDailyTasks } from "../features/Screens";

export const Route = createFileRoute("/auditor/tasks")({
  component: AuditorDailyTasks,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
});
