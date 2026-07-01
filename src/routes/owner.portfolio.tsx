import { createFileRoute } from "@tanstack/react-router";
import { CompanyPortfolio } from "../features/Screens";

export const Route = createFileRoute("/owner/portfolio")({
  component: CompanyPortfolio,
});
