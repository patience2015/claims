-- AlterTable
ALTER TABLE "Claim" ADD COLUMN "closureReason" TEXT;

-- CreateTable
CREATE TABLE "EmailNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" DATETIME,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailNotification_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Policyholder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "vehicleMake" TEXT NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "vehicleYear" INTEGER NOT NULL,
    "vehiclePlate" TEXT NOT NULL,
    "vehicleVin" TEXT,
    "policyNumber" TEXT NOT NULL,
    "contractStart" DATETIME NOT NULL,
    "contractEnd" DATETIME NOT NULL,
    "coverageType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    CONSTRAINT "Policyholder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Policyholder" ("address", "contractEnd", "contractStart", "coverageType", "createdAt", "email", "firstName", "id", "lastName", "phone", "policyNumber", "updatedAt", "vehicleMake", "vehicleModel", "vehiclePlate", "vehicleVin", "vehicleYear") SELECT "address", "contractEnd", "contractStart", "coverageType", "createdAt", "email", "firstName", "id", "lastName", "phone", "policyNumber", "updatedAt", "vehicleMake", "vehicleModel", "vehiclePlate", "vehicleVin", "vehicleYear" FROM "Policyholder";
DROP TABLE "Policyholder";
ALTER TABLE "new_Policyholder" RENAME TO "Policyholder";
CREATE UNIQUE INDEX "Policyholder_policyNumber_key" ON "Policyholder"("policyNumber");
CREATE UNIQUE INDEX "Policyholder_userId_key" ON "Policyholder"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
