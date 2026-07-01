import { createFileRoute } from "@tanstack/react-router";
import { AppOwnerMaintenanceLogs } from "../features/Screens";

export const Route = createFileRoute("/appowner/maintenance")({
  component: AppOwnerMaintenanceLogs,
});
