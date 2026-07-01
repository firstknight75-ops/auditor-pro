import { createFileRoute } from "@tanstack/react-router";
import { OwnerAdvisor } from "../features/Screens";

export const Route = createFileRoute("/owner/advisor")({
  component: OwnerAdvisor,
});
