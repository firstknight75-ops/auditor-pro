import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "../components/route-loading";
import { RouteError } from "../components/route-error";
import { AppOwnerTemplateEditor } from "../features/Screens";

export const Route = createFileRoute("/appowner/templates")({
  component: AppOwnerTemplateEditor,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
});
