/**
 * Script de test des prompts IA — ClaimFlow
 * Usage: DATABASE_URL="file:./dev.db" npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/test-ai.ts
 *
 * Ce script teste les 4 fonctions IA directement, sans passer par l'API HTTP.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { extractClaimInfo } from "../src/lib/ai-service";
import { analyzeFraud } from "../src/lib/ai-service";
import { estimateIndemnization } from "../src/lib/ai-service";
import { generateLetter } from "../src/lib/ai-service";

// ─── Données de test ───────────────────────────────────────────────────────

const TEST_DESCRIPTION = `
Le 15 janvier 2026 vers 8h30, à l'intersection de la rue de Rivoli et du boulevard Sébastopol à Paris (75001),
un scooter immatriculé AB-123-CD a percuté l'arrière de mon véhicule Renault Clio (immat. EF-456-GH, 2021)
alors que j'étais arrêté à un feu rouge. Le conducteur du scooter, M. Martin Jean (06 12 34 56 78),
assuré chez AXA, était présent. Un procès-verbal a été dressé par la police (commissariat du 1er arrondissement).
Dégâts : pare-chocs arrière enfoncé, coffre déformé, feu arrière droit brisé.
`;

const TEST_CLAIM = {
  id: "test-claim-001",
  claimNumber: "SIN-2026-00001",
  type: "COLLISION",
  description: TEST_DESCRIPTION,
  incidentDate: new Date("2026-01-15T08:30:00"),
  incidentLocation: "Rue de Rivoli / Bd Sébastopol, Paris 75001",
  thirdPartyInvolved: true,
  fraudScore: null,
  estimatedAmount: null,
  createdAt: new Date("2026-01-15T10:00:00"),
  policyholder: {
    firstName: "Sophie",
    lastName: "Durand",
    email: "sophie.durand@email.fr",
    vehicleMake: "Renault",
    vehicleModel: "Clio",
    vehicleYear: 2021,
    vehiclePlate: "EF-456-GH",
    policyNumber: "POL-2024-00042",
    coverageType: "COMPREHENSIVE",
  },
};

// ─── Runner ────────────────────────────────────────────────────────────────

async function runTest<T>(
  name: string,
  fn: () => Promise<{ result: T; tokensUsed: number; durationMs: number }>
) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`▶  ${name}`);
  console.log("═".repeat(60));
  try {
    const { result, tokensUsed, durationMs } = await fn();
    console.log(`✅ Succès — ${durationMs}ms — ${tokensUsed} tokens`);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`❌ Erreur:`, err);
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🚀 ClaimFlow AI — Test des prompts\n");
  console.log(`Modèle : claude-sonnet-4-6`);
  console.log(`API Key : ${process.env.ANTHROPIC_API_KEY ? "✅ présente" : "❌ manquante"}`);

  // 1. Extraction
  await runTest("Extraction d'informations", () =>
    extractClaimInfo(TEST_DESCRIPTION, {
      type: TEST_CLAIM.type,
      policyNumber: TEST_CLAIM.policyholder.policyNumber,
    })
  );

  // 2. Scoring de fraude
  await runTest("Scoring de fraude", () =>
    analyzeFraud({
      ...TEST_CLAIM,
      daysSinceIncident: 0, // déclaré immédiatement
    })
  );

  // 3. Estimation d'indemnisation
  await runTest("Estimation d'indemnisation", () =>
    estimateIndemnization(TEST_CLAIM)
  );

  // 4. Courriers (tous les types)
  for (const letterType of [
    "ACKNOWLEDGMENT",
    "APPROVAL",
    "REJECTION",
    "DOCUMENT_REQUEST",
    "INFO_REQUEST",
  ] as const) {
    await runTest(`Courrier : ${letterType}`, () =>
      generateLetter(TEST_CLAIM, letterType)
    );
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log("✅ Tous les tests terminés");
}

main().catch(console.error);
