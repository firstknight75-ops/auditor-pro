import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "../components/route-loading";
import { RouteError } from "../components/route-error";
import { SecureActivityLedger } from "../features/Screens";

export const Route = createFileRoute("/owner/ledger")({
  component: SecureActivityLedger,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
});
