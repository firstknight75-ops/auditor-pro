import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "../components/route-loading";
import { RouteError } from "../components/route-error";
import { AppOwnerMaintenanceLogs } from "../features/Screens";

export const Route = createFileRoute("/appowner/maintenance")({
  component: AppOwnerMaintenanceLogs,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
});
