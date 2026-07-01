import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "../components/route-loading";
import { RouteError } from "../components/route-error";
import { AuditorCertificationEnvironment } from "../features/Screens";

export const Route = createFileRoute("/auditor/")({
  component: AuditorCertificationEnvironment,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
});
