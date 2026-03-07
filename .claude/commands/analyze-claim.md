Trigger a full AI analysis on a specific claim and display the results.

Claim ID or number (SIN-YYYY-NNNNN): $ARGUMENTS

If not provided above, ask the user for the claim ID or number.

Steps:
1. Find the claim: `GET /api/claims` filtered by claimNumber, or read directly from the database
2. Show current claim state: status, type, description, fraudScore (null if not yet analyzed)
3. Confirm with the user before triggering analysis (it consumes AI tokens)
4. Call `POST /api/claims/:id/analyze`
5. Display results in sections:

**Extraction automatique**
- Type de sinistre détecté
- Date et lieu de l'incident
- Parties impliquées
- Véhicule(s) concerné(s)

**Score de fraude**
- Score: X/100 — Niveau: LOW/MODERATE/HIGH/CRITICAL
- Facteurs détectés avec poids
- Résumé et recommandation IA

**Estimation d'indemnisation**
- Montant minimum: X €
- Montant probable: X €
- Montant maximum: X €
- Ventilation par poste de dommage

**Courrier généré**
- Type: ACKNOWLEDGMENT / APPROVAL / REJECTION / etc.
- Aperçu du courrier (100 premiers caractères)

If the analysis fails, show the error and suggest remediation.
