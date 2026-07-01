import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "../components/route-loading";
import { RouteError } from "../components/route-error";
import { ManagerCorrectionTasks } from "../features/Screens";

export const Route = createFileRoute("/manager/tasks")({
  component: ManagerCorrectionTasks,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
});
