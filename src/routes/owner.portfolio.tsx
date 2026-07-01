import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "../components/route-loading";
import { RouteError } from "../components/route-error";
import { CompanyPortfolio } from "../features/Screens";

export const Route = createFileRoute("/owner/portfolio")({
  component: CompanyPortfolio,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
});
