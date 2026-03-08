-- CreateTable
CREATE TABLE "FraudNetwork" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "networkNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "networkScore" INTEGER NOT NULL DEFAULT 0,
    "nodeCount" INTEGER NOT NULL DEFAULT 0,
    "claimCount" INTEGER NOT NULL DEFAULT 0,
    "avgFraudScore" REAL NOT NULL DEFAULT 0,
    "density" REAL NOT NULL DEFAULT 0,
    "nodesJson" TEXT NOT NULL DEFAULT '[]',
    "mergedFrom" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FraudLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "networkId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "targetLabel" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "claimIds" TEXT NOT NULL DEFAULT '[]',
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FraudLink_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "FraudNetwork" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FraudNetworkAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "networkId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "metadata" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FraudNetworkAudit_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "FraudNetwork" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "incidentDate" DATETIME NOT NULL,
    "incidentLocation" TEXT NOT NULL,
    "thirdPartyInvolved" BOOLEAN NOT NULL DEFAULT false,
    "thirdPartyInfo" TEXT,
    "estimatedAmount" REAL,
    "approvedAmount" REAL,
    "fraudScore" INTEGER,
    "fraudRisk" TEXT,
    "closureReason" TEXT,
    "repairGarage" TEXT,
    "expertName" TEXT,
    "networkScore" INTEGER,
    "networkRisk" TEXT,
    "networkId" TEXT,
    "policyholderID" TEXT NOT NULL,
    "assignedToID" TEXT,
    "createdByID" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Claim_policyholderID_fkey" FOREIGN KEY ("policyholderID") REFERENCES "Policyholder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Claim_assignedToID_fkey" FOREIGN KEY ("assignedToID") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Claim_createdByID_fkey" FOREIGN KEY ("createdByID") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Claim_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "FraudNetwork" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Claim" ("approvedAmount", "assignedToID", "claimNumber", "closureReason", "createdAt", "createdByID", "description", "estimatedAmount", "fraudRisk", "fraudScore", "id", "incidentDate", "incidentLocation", "policyholderID", "status", "thirdPartyInfo", "thirdPartyInvolved", "type", "updatedAt") SELECT "approvedAmount", "assignedToID", "claimNumber", "closureReason", "createdAt", "createdByID", "description", "estimatedAmount", "fraudRisk", "fraudScore", "id", "incidentDate", "incidentLocation", "policyholderID", "status", "thirdPartyInfo", "thirdPartyInvolved", "type", "updatedAt" FROM "Claim";
DROP TABLE "Claim";
ALTER TABLE "new_Claim" RENAME TO "Claim";
CREATE UNIQUE INDEX "Claim_claimNumber_key" ON "Claim"("claimNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "FraudNetwork_networkNumber_key" ON "FraudNetwork"("networkNumber");

-- CreateIndex
CREATE INDEX "FraudLink_networkId_idx" ON "FraudLink"("networkId");

-- CreateIndex
CREATE INDEX "FraudLink_sourceKey_targetKey_idx" ON "FraudLink"("sourceKey", "targetKey");

-- CreateIndex
CREATE INDEX "FraudNetworkAudit_networkId_idx" ON "FraudNetworkAudit"("networkId");
