import { createFileRoute } from "@tanstack/react-router";
import { AppOwnerTemplateEditor } from "../features/Screens";

export const Route = createFileRoute("/appowner/templates")({
  component: AppOwnerTemplateEditor,
});
