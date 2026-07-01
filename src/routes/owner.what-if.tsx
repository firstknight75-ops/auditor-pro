import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "../components/route-loading";
import { RouteError } from "../components/route-error";
import { DecisionSimulator } from "../features/Screens";

export const Route = createFileRoute("/owner/what-if")({
  component: DecisionSimulator,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
});
