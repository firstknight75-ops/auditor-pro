import { createFileRoute } from "@tanstack/react-router";
import { AuditorDailyTasks } from "../features/Screens";

export const Route = createFileRoute("/auditor/tasks")({
  component: AuditorDailyTasks,
});
