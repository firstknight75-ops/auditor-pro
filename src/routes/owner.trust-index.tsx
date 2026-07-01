import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "../components/route-loading";
import { RouteError } from "../components/route-error";
import { TrustIndexHub } from "../features/Screens";

export const Route = createFileRoute("/owner/trust-index")({
  component: TrustIndexHub,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
});
