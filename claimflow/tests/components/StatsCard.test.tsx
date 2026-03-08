import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { FileText } from "lucide-react";

describe("StatsCard", () => {
  it("renders title and value", () => {
    render(<StatsCard title="Total sinistres" value={42} icon={FileText} />);
    expect(screen.getByText("Total sinistres")).toBeDefined();
    expect(screen.getByText("42")).toBeDefined();
  });

  it("renders string value", () => {
    render(<StatsCard title="Taux de fraude" value="12%" icon={FileText} />);
    expect(screen.getByText("12%")).toBeDefined();
  });

  it("renders description when provided", () => {
    render(<StatsCard title="Sinistres" value={10} icon={FileText} description="Période : 30j" />);
    expect(screen.getByText("Période : 30j")).toBeDefined();
  });

  it("renders positive trend", () => {
    render(<StatsCard title="Sinistres" value={10} icon={FileText} trend={15} />);
    expect(screen.getByText(/15%/)).toBeDefined();
  });

  it("renders negative trend", () => {
    render(<StatsCard title="Sinistres" value={10} icon={FileText} trend={-8} />);
    expect(screen.getByText(/8%/)).toBeDefined();
  });

  it("does not render trend when not provided", () => {
    const { container } = render(<StatsCard title="Sinistres" value={10} icon={FileText} />);
    expect(container.querySelector(".text-green-600, .text-red-600")).toBeNull();
  });
});
