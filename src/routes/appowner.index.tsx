import { createFileRoute } from "@tanstack/react-router";
import { AppOwnerClientManagement } from "../features/Screens";

export const Route = createFileRoute("/appowner/")({
  component: AppOwnerClientManagement,
});
