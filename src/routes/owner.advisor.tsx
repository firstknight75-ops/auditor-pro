import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "../components/route-loading";
import { RouteError } from "../components/route-error";
import { OwnerAdvisor } from "../features/Screens";

export const Route = createFileRoute("/owner/advisor")({
  component: OwnerAdvisor,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
});
