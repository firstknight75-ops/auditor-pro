import { createFileRoute } from "@tanstack/react-router";
import { AuditorCertificationEnvironment } from "../features/Screens";

export const Route = createFileRoute("/auditor/")({
  component: AuditorCertificationEnvironment,
});
