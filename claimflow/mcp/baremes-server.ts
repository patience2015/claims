#!/usr/bin/env node
/**
 * MCP Barèmes Server — ClaimFlow AI
 * Expose les barèmes d'indemnisation automobile (§4.3 du PRD)
 * via le protocole Model Context Protocol (MCP).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ─── Barème de référence (PRD §4.3) ───────────────────────────────────────────
const BAREMES: Record<string, { category: string; min: number; max: number; notes?: string }[]> = {
  GLASS: [
    { category: "Pare-brise", min: 300, max: 800 },
    { category: "Vitre latérale ou lunette arrière", min: 150, max: 600 },
  ],
  COLLISION: [
    { category: "Carrosserie légère (rayure, bosse)", min: 300, max: 1500 },
    { category: "Carrosserie lourde (déformation structurelle)", min: 1500, max: 8000 },
    { category: "Perte totale", min: 0, max: 0, notes: "Valeur Argus − franchise" },
  ],
  THEFT: [
    { category: "Vol total du véhicule", min: 0, max: 0, notes: "Valeur Argus − franchise − vétusté" },
  ],
  VANDALISM: [
    { category: "Dégradation légère à lourde", min: 200, max: 5000 },
  ],
  FIRE: [
    { category: "Incendie partiel", min: 2000, max: 15000 },
    { category: "Incendie total", min: 0, max: 0, notes: "Valeur Argus" },
  ],
  NATURAL_DISASTER: [
    { category: "Tous types de dommages", min: 380, max: 0, notes: "Franchise légale minimale 380 €" },
  ],
  BODILY_INJURY: [
    { category: "Dommages corporels légers", min: 1000, max: 5000 },
  ],
  OTHER: [
    { category: "Autres sinistres", min: 200, max: 5000, notes: "Estimation variable selon contexte" },
  ],
};

// ─── Helper: recherche du barème ──────────────────────────────────────────────
function getBareme(claimType: string, damageCategory?: string) {
  const baremes = BAREMES[claimType.toUpperCase()];
  if (!baremes) {
    return { error: `Type inconnu: ${claimType}. Types disponibles: ${Object.keys(BAREMES).join(", ")}` };
  }

  if (damageCategory) {
    const match = baremes.find(b =>
      b.category.toLowerCase().includes(damageCategory.toLowerCase())
    );
    return match ? { type: claimType, baremes: [match] } : { type: claimType, baremes };
  }

  return { type: claimType, baremes };
}

function estimateFromBareme(claimType: string, damageCategory: string, vehicleValue?: number) {
  const result = getBareme(claimType, damageCategory);
  if ("error" in result) return result;

  const baremes = result.baremes;
  const estimates = baremes.map(b => {
    let min = b.min;
    let max = b.max;
    let probable = 0;

    // Pour les cas dépendant de la valeur Argus
    if (b.notes && vehicleValue) {
      if (b.notes.includes("Valeur Argus − franchise")) {
        const franchise = Math.min(vehicleValue * 0.1, 1000); // franchise typique 10% max 1000€
        min = vehicleValue - franchise - vehicleValue * 0.1;
        max = vehicleValue - franchise;
        probable = (min + max) / 2;
      } else if (b.notes.includes("Valeur Argus")) {
        min = vehicleValue * 0.8;
        max = vehicleValue;
        probable = vehicleValue * 0.9;
      }
    }

    if (max > 0 && min >= 0) {
      probable = probable || Math.round((min + max) / 2);
    }

    return {
      category: b.category,
      min,
      max,
      probable,
      notes: b.notes,
    };
  });

  return {
    claimType,
    damageCategory: damageCategory || "all",
    estimates,
    currency: "EUR",
    reference: "Barème assurance automobile France 2025-2026",
  };
}

// ─── MCP Server ───────────────────────────────────────────────────────────────
const server = new Server(
  { name: "claimflow-baremes", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_bareme",
      description: "Retourne le barème d'indemnisation pour un type de sinistre donné. Types: GLASS, COLLISION, THEFT, VANDALISM, FIRE, NATURAL_DISASTER, BODILY_INJURY, OTHER.",
      inputSchema: {
        type: "object",
        properties: {
          claimType: {
            type: "string",
            description: "Type de sinistre (GLASS, COLLISION, THEFT, VANDALISM, FIRE, NATURAL_DISASTER, BODILY_INJURY, OTHER)",
          },
          damageCategory: {
            type: "string",
            description: "Catégorie de dommage optionnelle pour filtrer (ex: 'pare-brise', 'carrosserie légère')",
          },
        },
        required: ["claimType"],
      },
    },
    {
      name: "estimate_indemnization",
      description: "Calcule une estimation d'indemnisation basée sur le barème officiel pour un type de sinistre et une catégorie de dommage.",
      inputSchema: {
        type: "object",
        properties: {
          claimType: {
            type: "string",
            description: "Type de sinistre",
          },
          damageCategory: {
            type: "string",
            description: "Catégorie de dommage",
          },
          vehicleValue: {
            type: "number",
            description: "Valeur Argus du véhicule en euros (requis pour pertes totales, vols, incendies totaux)",
          },
        },
        required: ["claimType", "damageCategory"],
      },
    },
    {
      name: "list_claim_types",
      description: "Liste tous les types de sinistres disponibles avec leurs catégories de dommage.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_bareme") {
      const { claimType, damageCategory } = args as { claimType: string; damageCategory?: string };
      const result = getBareme(claimType, damageCategory);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === "estimate_indemnization") {
      const { claimType, damageCategory, vehicleValue } = args as {
        claimType: string;
        damageCategory: string;
        vehicleValue?: number;
      };
      const result = estimateFromBareme(claimType, damageCategory, vehicleValue);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === "list_claim_types") {
      const types = Object.entries(BAREMES).map(([type, categories]) => ({
        type,
        categories: categories.map(c => c.category),
        categoryCount: categories.length,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ claimTypes: types }, null, 2) }],
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify({ error: `Outil inconnu: ${name}` }) }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: (error as Error).message }) }],
      isError: true,
    };
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ClaimFlow Barèmes MCP Server running on stdio");
}

main().catch(console.error);
