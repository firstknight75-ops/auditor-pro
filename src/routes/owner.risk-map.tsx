import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "../components/route-loading";
import { RouteError } from "../components/route-error";
import { RiskMap } from "../features/Screens";

export const Route = createFileRoute("/owner/risk-map")({
  component: RiskMap,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
});
