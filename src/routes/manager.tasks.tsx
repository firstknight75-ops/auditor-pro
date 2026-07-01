import { createFileRoute } from "@tanstack/react-router";
import { ManagerCorrectionTasks } from "../features/Screens";

export const Route = createFileRoute("/manager/tasks")({
  component: ManagerCorrectionTasks,
});
