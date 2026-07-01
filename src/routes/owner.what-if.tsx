import { createFileRoute } from "@tanstack/react-router";
import { DecisionSimulator } from "../features/Screens";

export const Route = createFileRoute("/owner/what-if")({
  component: DecisionSimulator,
});
