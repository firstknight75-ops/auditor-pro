import { createFileRoute } from "@tanstack/react-router";
import { WasteMapViewer } from "../features/Screens";

export const Route = createFileRoute("/owner/waste-map")({
  component: WasteMapViewer,
});
