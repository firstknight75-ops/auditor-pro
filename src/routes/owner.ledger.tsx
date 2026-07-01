import { createFileRoute } from "@tanstack/react-router";
import { SecureActivityLedger } from "../features/Screens";

export const Route = createFileRoute("/owner/ledger")({
  component: SecureActivityLedger,
});
