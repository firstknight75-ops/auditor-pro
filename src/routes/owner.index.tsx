import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "../components/route-loading";
import { RouteError } from "../components/route-error";
import { OwnerExecutiveDashboard } from "../features/Screens";

export const Route = createFileRoute("/owner/")({
  component: OwnerExecutiveDashboard,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
});
