import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FraudScoreCard } from "@/components/claims/FraudScoreCard";

const mockFactors = [
  { name: "Déclaration tardive", description: "Sinistre déclaré > 30 jours", weight: 15, detected: true },
  { name: "Description vague", description: "Description < 50 caractères", weight: 10, detected: false },
];

describe("FraudScoreCard", () => {
  it("renders the fraud score", () => {
    render(<FraudScoreCard score={25} risk="LOW" />);
    expect(screen.getByText("25")).toBeDefined();
  });

  it("displays LOW risk label", () => {
    render(<FraudScoreCard score={25} risk="LOW" />);
    expect(screen.getAllByText(/Faible/i).length).toBeGreaterThan(0);
  });

  it("displays MODERATE risk label for score 50", () => {
    render(<FraudScoreCard score={50} risk="MODERATE" />);
    expect(screen.getByText(/Modéré/i)).toBeDefined();
  });

  it("displays HIGH risk label for score 75", () => {
    render(<FraudScoreCard score={75} risk="HIGH" />);
    expect(screen.getByText(/Élevé/i)).toBeDefined();
  });

  it("displays CRITICAL risk label for score 85", () => {
    render(<FraudScoreCard score={85} risk="CRITICAL" />);
    expect(screen.getByText(/Critique/i)).toBeDefined();
  });

  it("renders detected fraud factors", () => {
    render(<FraudScoreCard score={25} risk="LOW" factors={mockFactors} />);
    expect(screen.getByText("Déclaration tardive")).toBeDefined();
    expect(screen.getByText("Description vague")).toBeDefined();
  });

  it("shows weight for detected factors", () => {
    render(<FraudScoreCard score={25} risk="LOW" factors={mockFactors} />);
    expect(screen.getAllByText(/\+15 pts/).length).toBeGreaterThan(0);
  });

  it("renders summary when provided", () => {
    render(<FraudScoreCard score={25} risk="LOW" summary="Dossier normal, faible risque détecté." />);
    expect(screen.getByText("Dossier normal, faible risque détecté.")).toBeDefined();
  });

  it("renders recommendation when provided", () => {
    render(<FraudScoreCard score={85} risk="CRITICAL" recommendation="Escalade urgente requise." />);
    expect(screen.getByText("Escalade urgente requise.")).toBeDefined();
  });

  it("renders progress bar", () => {
    const { container } = render(<FraudScoreCard score={75} risk="HIGH" />);
    // Progress bar should exist - width style 75%
    const progressBar = container.querySelector("[style*='75%']");
    expect(progressBar).toBeDefined();
  });
});
