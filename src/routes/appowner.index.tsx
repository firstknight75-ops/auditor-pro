import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "../components/route-loading";
import { RouteError } from "../components/route-error";
import { AppOwnerClientManagement } from "../features/Screens";

export const Route = createFileRoute("/appowner/")({
  component: AppOwnerClientManagement,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
});
