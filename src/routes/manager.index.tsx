import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "../components/route-loading";
import { RouteError } from "../components/route-error";
import { ManagerDashboard } from "../features/Screens";

export const Route = createFileRoute("/manager/")({
  component: ManagerDashboard,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
});
