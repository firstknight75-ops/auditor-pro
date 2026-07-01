import { createFileRoute } from "@tanstack/react-router";
import { RoutePending } from "../components/route-loading";
import { RouteError } from "../components/route-error";
import { WasteMapViewer } from "../features/Screens";

export const Route = createFileRoute("/owner/waste-map")({
  component: WasteMapViewer,
  pendingComponent: RoutePending,
  errorComponent: RouteError,
});
