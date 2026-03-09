import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notification-service";

// ─── Normalisation ─────────────────────────────────────────────────────────────

function normalizeGarage(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\-_.,']/g, "")
    .replace(/[éèê]/g, "e")
    .replace(/[àâ]/g, "a");
}

function normalizeExpert(name: string): string {
  return name.toLowerCase().trim().split(/\s+/).sort().join("_");
}

function normalizeLocation(location: string): string {
  const match = location.match(/(\d{5})/);
  const cp = match ? match[1] : "";
  return `${location.substring(0, 30).toLowerCase().replace(/\s+/g, "_")}_${cp}`;
}

// ─── Extraction des nœuds d'un sinistre ────────────────────────────────────────

interface ClaimNode {
  type: "POLICYHOLDER" | "GARAGE" | "EXPERT" | "LOCATION";
  key: string;
  label: string;
}

interface ClaimForNetwork {
  id: string;
  policyholderID: string;
  policyholder?: { firstName: string; lastName: string } | null;
  repairGarage?: string | null;
  expertName?: string | null;
  incidentLocation?: string | null;
}

function extractNodes(claim: ClaimForNetwork): ClaimNode[] {
  const nodes: ClaimNode[] = [];

  // POLICYHOLDER
  const phLabel = claim.policyholder
    ? `${claim.policyholder.firstName} ${claim.policyholder.lastName}`
    : claim.policyholderID;
  nodes.push({ type: "POLICYHOLDER", key: `ph_${claim.policyholderID}`, label: phLabel });

  // GARAGE
  if (claim.repairGarage?.trim()) {
    const key = `garage_${normalizeGarage(claim.repairGarage)}`;
    nodes.push({ type: "GARAGE", key, label: claim.repairGarage.trim() });
  }

  // EXPERT
  if (claim.expertName?.trim()) {
    const key = `expert_${normalizeExpert(claim.expertName)}`;
    nodes.push({ type: "EXPERT", key, label: claim.expertName.trim() });
  }

  // LOCATION
  if (claim.incidentLocation?.trim()) {
    const key = `loc_${normalizeLocation(claim.incidentLocation)}`;
    nodes.push({ type: "LOCATION", key, label: claim.incidentLocation.trim() });
  }

  return nodes;
}

// ─── Union-Find ────────────────────────────────────────────────────────────────

class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    return this.parent.get(x)!;
  }

  union(x: string, y: string): void {
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx === ry) return;
    const rankX = this.rank.get(rx) ?? 0;
    const rankY = this.rank.get(ry) ?? 0;
    if (rankX < rankY) this.parent.set(rx, ry);
    else if (rankX > rankY) this.parent.set(ry, rx);
    else {
      this.parent.set(ry, rx);
      this.rank.set(rx, rankX + 1);
    }
  }
}

// ─── Calcul du density ─────────────────────────────────────────────────────────

function calcDensity(nodeCount: number, linkCount: number): number {
  if (nodeCount < 2) return 0;
  const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
  return Math.min(linkCount / maxEdges, 1);
}

// ─── Qualification cluster ─────────────────────────────────────────────────────

function qualifyCluster(
  nodeCount: number,
  claimCount: number,
  avgFraudScore: number,
  density: number
): "INACTIVE" | "ACTIVE" | "SUSPECT" | "CRITICAL" {
  if (
    nodeCount >= 6 &&
    claimCount >= 5 &&
    avgFraudScore >= 65 &&
    density >= 0.6
  )
    return "CRITICAL";
  if (
    nodeCount >= 3 &&
    claimCount >= 2 &&
    avgFraudScore >= 40 &&
    density >= 0.3
  )
    return "SUSPECT";
  if (nodeCount >= 2 && claimCount >= 1) return "ACTIVE";
  return "INACTIVE";
}

// ─── Calcul networkScore pour un sinistre ──────────────────────────────────────

function calcNetworkScore(
  status: string,
  avgFraudScore: number,
  density: number,
  garageCount: number,
  expertCount: number,
  locationCount: number
): number {
  // avgFraudScore used implicitly via status thresholds (qualifyCluster includes it)
  void avgFraudScore;

  let score = 0;
  if (status === "CRITICAL") score += 35;
  else if (status === "SUSPECT") score += 20;
  if (status === "CRITICAL") score += 15;
  else if (status === "SUSPECT") score += 10;
  if (density >= 0.6) score += 20;
  else if (density >= 0.3) score += 10;
  if (garageCount >= 5) score += 15;
  if (expertCount >= 5) score += 15;
  if (locationCount >= 3) score += 10;
  return Math.min(score, 100);
}

// ─── Génération du numéro réseau ──────────────────────────────────────────────

async function generateNetworkNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.fraudNetwork.count({
    where: { networkNumber: { startsWith: `NET-${year}-` } },
  });
  return `NET-${year}-${String(count + 1).padStart(5, "0")}`;
}

// ─── Recompute principal ───────────────────────────────────────────────────────

export async function recomputeFraudNetworks(
  scope: "FULL" | "INCREMENTAL" = "INCREMENTAL"
): Promise<{
  networksCreated: number;
  networksUpdated: number;
  claimsLinked: number;
  durationMs: number;
}> {
  const start = Date.now();
  let networksCreated = 0;
  let networksUpdated = 0;
  let claimsLinked = 0;

  // 1. Charger les sinistres
  const claims = await prisma.claim.findMany({
    where:
      scope === "INCREMENTAL"
        ? { status: { notIn: ["CLOSED", "REJECTED"] } }
        : {},
    include: { policyholder: true },
    orderBy: { createdAt: "desc" },
  });

  if (claims.length === 0) {
    return {
      networksCreated: 0,
      networksUpdated: 0,
      claimsLinked: 0,
      durationMs: Date.now() - start,
    };
  }

  // 2. Extraire les nœuds par sinistre
  const claimNodes = new Map<string, ClaimNode[]>();
  for (const claim of claims) {
    claimNodes.set(claim.id, extractNodes(claim as ClaimForNetwork));
  }

  // 3. Index nœud → sinistres
  const nodeToClaimIds = new Map<string, Set<string>>();
  for (const [claimId, nodes] of claimNodes) {
    for (const node of nodes) {
      if (!nodeToClaimIds.has(node.key)) nodeToClaimIds.set(node.key, new Set());
      nodeToClaimIds.get(node.key)!.add(claimId);
    }
  }

  // 4. Union-Find : relier les sinistres partageant un nœud
  const uf = new UnionFind();
  for (const claimId of claims.map((c) => c.id)) uf.find(claimId);
  for (const [, claimIds] of nodeToClaimIds) {
    const arr = [...claimIds];
    for (let i = 1; i < arr.length; i++) uf.union(arr[0], arr[i]);
  }

  // 5. Regrouper en clusters
  const clusters = new Map<string, string[]>(); // root → [claimIds]
  for (const claim of claims) {
    const root = uf.find(claim.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(claim.id);
  }

  // 6. Traiter chaque cluster
  for (const [, claimIds] of clusters) {
    if (claimIds.length < 2) continue; // Ignorer clusters d'un seul sinistre

    // Collecter tous les nœuds du cluster
    const nodeMap = new Map<string, ClaimNode & { claimIds: Set<string> }>();
    for (const claimId of claimIds) {
      for (const node of claimNodes.get(claimId) ?? []) {
        if (!nodeMap.has(node.key)) {
          nodeMap.set(node.key, { ...node, claimIds: new Set() });
        }
        nodeMap.get(node.key)!.claimIds.add(claimId);
      }
    }

    const nodeCount = nodeMap.size;
    const claimCount = claimIds.length;

    // Calculer les métriques
    const clusterClaims = claims.filter((c) => claimIds.includes(c.id));
    const avgFraudScore =
      clusterClaims.reduce((s, c) => s + (c.fraudScore ?? 0), 0) /
      clusterClaims.length;

    // Compter les liens uniques
    const linkSet = new Set<string>();
    for (const [, nodeData] of nodeMap) {
      const nodeClaimList = [...nodeData.claimIds];
      for (let i = 0; i < nodeClaimList.length; i++) {
        for (let j = i + 1; j < nodeClaimList.length; j++) {
          linkSet.add(`${nodeClaimList[i]}_${nodeClaimList[j]}`);
        }
      }
    }
    const density = calcDensity(nodeCount, linkSet.size);
    const status = qualifyCluster(nodeCount, claimCount, avgFraudScore, density);

    if (status === "INACTIVE") continue;

    // Calculer networkScore
    const garageCount = [...nodeMap.values()]
      .filter((n) => n.type === "GARAGE")
      .reduce((s, n) => s + n.claimIds.size, 0);
    const expertCount = [...nodeMap.values()]
      .filter((n) => n.type === "EXPERT")
      .reduce((s, n) => s + n.claimIds.size, 0);
    const locationCount = [...nodeMap.values()]
      .filter((n) => n.type === "LOCATION")
      .reduce((s, n) => s + n.claimIds.size, 0);
    const networkScore = calcNetworkScore(
      status,
      avgFraudScore,
      density,
      garageCount,
      expertCount,
      locationCount
    );

    // nodesJson
    const nodesArray = [...nodeMap.values()].map((n) => ({
      type: n.type,
      key: n.key,
      label: n.label,
      claimIds: [...n.claimIds],
    }));

    // Chercher FraudNetwork existant (via claimIds)
    const existingLink = await prisma.fraudLink.findFirst({
      where: { claimIds: { contains: claimIds[0] }, stale: false },
      include: { network: true },
    });

    let network: { id: string; status: string };

    if (
      existingLink?.network &&
      existingLink.network.status !== "DISMISSED"
    ) {
      // Update
      network = await prisma.fraudNetwork.update({
        where: { id: existingLink.networkId },
        data: {
          status,
          networkScore,
          nodeCount,
          claimCount,
          avgFraudScore,
          density,
          nodesJson: JSON.stringify(nodesArray),
          version: { increment: 1 },
        },
      });
      networksUpdated++;
    } else {
      // Create
      const networkNumber = await generateNetworkNumber();
      network = await prisma.fraudNetwork.create({
        data: {
          networkNumber,
          status,
          networkScore,
          nodeCount,
          claimCount,
          avgFraudScore,
          density,
          nodesJson: JSON.stringify(nodesArray),
        },
      });
      await prisma.fraudNetworkAudit.create({
        data: {
          networkId: network.id,
          action: "NETWORK_CREATED",
          after: JSON.stringify({
            status,
            networkScore,
            nodeCount,
            claimCount,
          }),
        },
      });
      networksCreated++;
    }

    // Upsert FraudLinks
    for (const [, nodeData] of nodeMap) {
      for (const [, otherNode] of nodeMap) {
        if (nodeData.key >= otherNode.key) continue;
        const sharedClaims = [...nodeData.claimIds].filter((id) =>
          otherNode.claimIds.has(id)
        );
        if (sharedClaims.length === 0) continue;
        const weight = Math.min(sharedClaims.length * 0.8, 10.0);
        // Use a stable, unique link ID based on network + node pair
        const stableId = `${network.id}_${nodeData.key}_${otherNode.key}`.substring(0, 25);
        await prisma.fraudLink.upsert({
          where: { id: stableId },
          create: {
            id: stableId,
            networkId: network.id,
            sourceType: nodeData.type,
            sourceKey: nodeData.key,
            sourceLabel: nodeData.label,
            targetType: otherNode.type,
            targetKey: otherNode.key,
            targetLabel: otherNode.label,
            weight,
            occurrences: sharedClaims.length,
            claimIds: JSON.stringify(sharedClaims),
          },
          update: {
            weight,
            occurrences: sharedClaims.length,
            claimIds: JSON.stringify(sharedClaims),
            stale: false,
          },
        });
      }
    }

    // Update Claim networkScore + networkId
    for (const claimId of claimIds) {
      await prisma.claim.update({
        where: { id: claimId },
        data: { networkScore, networkRisk: status, networkId: network.id },
      });
      claimsLinked++;
    }

    // Notifications si CRITICAL nouveau
    if (status === "CRITICAL" && !existingLink?.network) {
      const managers = await prisma.user.findMany({
        where: { role: { in: ["MANAGER", "ADMIN"] }, active: true },
        select: { id: true },
      });
      for (const mgr of managers) {
        void createNotification({
          userId: mgr.id,
          type: "FRAUD_ALERT",
          title: `Réseau fraude critique détecté`,
          body: `Un nouveau cluster CRITICAL (${nodeCount} nœuds, ${claimCount} sinistres, score ${networkScore}) a été détecté.`,
          claimId: claimIds[0],
        }).catch(console.error);
      }
    }
  }

  return {
    networksCreated,
    networksUpdated,
    claimsLinked,
    durationMs: Date.now() - start,
  };
}

// ─── Injection networkScore dans analyzeFraud ──────────────────────────────────

export async function getNetworkScoreForClaim(
  claimId: string
): Promise<{ networkScore: number; networkRisk: string }> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: { networkScore: true, networkRisk: true },
  });
  return {
    networkScore: claim?.networkScore ?? 0,
    networkRisk: claim?.networkRisk ?? "NONE",
  };
}
