import { createFileRoute } from "@tanstack/react-router";
import { TrustIndexHub } from "../features/Screens";

export const Route = createFileRoute("/owner/trust-index")({
  component: TrustIndexHub,
});
