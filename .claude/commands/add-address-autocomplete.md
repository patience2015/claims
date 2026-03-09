---
name: add-address-autocomplete
description: Ajoute un hook d'autocomplétion d'adresse gratuit (API Adresse BAN) et son intégration UI.
---

# Commande : /add-address-autocomplete

Cette commande déploie la solution d'autocomplétion d'adresse française gratuite.

## Composants créés
1. **Hook `useAddressAutocomplete`** :
   - Interroge `api-adresse.data.gouv.fr/search/`.
   - Extrait : Adresse formatée, Ville, Code Postal, Pays, latitude, longitude.
   - Gère les états de chargement et les erreurs.

2. **Intégration UI recommandée** :
   - Utilisez un `input` texte standard avec une liste de suggestions flottante.
   - Fermez la liste à la sélection d'un résultat.

## Schéma requis
Assurez-vous que votre modèle (Prisma/Zod) contient ces champs :
- `incidentLocation`: String
- `incidentCity`: String?
- `incidentZipCode`: String?
- `incidentCountry`: String?
- `latitude`: Float?
- `longitude`: Float?

## Utilisation
- Copiez `src/hooks/use-address-autocomplete.ts` dans votre projet.
- Connectez les fonctions `searchAddress` et `handleSelectAddress` à votre formulaire.
