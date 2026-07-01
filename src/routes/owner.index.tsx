import { createFileRoute } from "@tanstack/react-router";
import { OwnerExecutiveDashboard } from "../features/Screens";

export const Route = createFileRoute("/owner/")({
  component: OwnerExecutiveDashboard,
});
