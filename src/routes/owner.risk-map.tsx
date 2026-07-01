import { createFileRoute } from "@tanstack/react-router";
import { RiskMap } from "../features/Screens";

export const Route = createFileRoute("/owner/risk-map")({
  component: RiskMap,
});
