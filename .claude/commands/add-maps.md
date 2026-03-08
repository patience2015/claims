---
name: add-maps
description: Installe et intègre l'API Google Maps avec autocomplétion dans le formulaire ClaimFlow.
---

# Commande : /add-maps

Cette commande installe les dépendances et configure l'interface pour pouvoir sélectionner le lieu d'un sinistre via Google Maps.

## Étapes d'exécution
1. **Installation** : Exécutez `npm install @react-google-maps/api` dans le répertoire `/claimflow`.
2. **Formulaire de sinistre (`ClaimForm`)** :
   - Ajoutez le champ d'autocomplétion (Autocomplete) dans l'étape 3 (`Circonstances`).
   - Le champ doit capturer l'adresse formatée, ainsi que la latitude et la longitude.
3. **Mise à jour Zod** :
   - Modifiez le schéma de validation du formulaire (ex. `src/lib/validations/claim.ts` ou le fichier equivalent) pour ajouter `latitude: z.number().optional()` et `longitude: z.number().optional()`.
   - Modifiez le modèle côté Prisma ou TS si nécessaire pour stocker ces paires.
4. **Affichage du Sinistre (Détail)** :
   - Sur la page de détail d'un sinistre (`[id]`), intégrez un composant visualisant la carte statique ou interactive de ce lieu.
5. **Variables d'environnement** :
   - N'oubliez pas de dire à l'utilisateur de configurer `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` dans `.env.local`.
