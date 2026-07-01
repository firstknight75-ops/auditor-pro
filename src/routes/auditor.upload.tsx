import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "../components/route-loading";
import { RouteError } from "../components/route-error";
import { AuditorUploadDocument } from "../features/Screens";

export const Route = createFileRoute("/auditor/upload")({
  component: AuditorUploadDocument,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
});
