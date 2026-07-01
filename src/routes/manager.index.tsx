import { createFileRoute } from "@tanstack/react-router";
import { ManagerDashboard } from "../features/Screens";

export const Route = createFileRoute("/manager/")({
  component: ManagerDashboard,
});
