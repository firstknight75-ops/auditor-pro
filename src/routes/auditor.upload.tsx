import { createFileRoute } from "@tanstack/react-router";
import { AuditorUploadDocument } from "../features/Screens";

export const Route = createFileRoute("/auditor/upload")({
  component: AuditorUploadDocument,
});
