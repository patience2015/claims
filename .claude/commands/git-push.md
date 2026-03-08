Contexte optionnel (branche cible, force...) :
$ARGUMENTS

---

Effectue un push sécurisé vers GitHub et annonce le démarrage du process de déploiement Cloudflare.

### 1. Vérification de l'arbre
Avant de pousser, il faut s'assurer que le travail est terminé :
```bash
git -C /c/projets/claims status
```
S'il reste des fichiers modifiés et suivis (`Changes not staged for commit` ou `Changes to be committed`), signalez à l'utilisateur qu'il doit soit commiter, soit stash avant de push :
"Votre copie de travail n'est pas propre. Voulez-vous que je commite ces changements d'abord (via la commande `/commit`) ?"

### 2. Identifier la branche
```bash
git -C /c/projets/claims branch --show-current
```
Récupérez le nom de la branche actuelle locale.

### 3. Analyser la nécessité d'un pull
Effectuez un fetch silencieux et vérifiez l'état de la branche locale versus le remote origin :
```bash
git -C /c/projets/claims fetch origin
git -C /c/projets/claims status -uno
```
Si le retour dit `Your branch is behind 'origin/X' by N commits`, arrêtez et proposez un **rebase** interactif ou un `git pull --rebase`. **Ne poussez pas en force avec des erreurs.**

### 4. Exécuter le Push
Si tout est propre et la branche est à jour ou en avance, exécutez la poussée :
```bash
git -C /c/projets/claims push -u origin <branche-courante>
```

### 5. Annonce CI/CD Cloudflare
Si le push réussit, affichez distinctement ce message :
```markdown
🚀 **Push réussi vers GitHub !**

La branche `<branche>` a été mise à jour sur le serveur.
Le pipeline d'intégration (GitHub Actions) a pris le relais et le déploiement sur **Cloudflare** est en cours.
 
> 💡 *Astuce : Vous pouvez surveiller l'avancement du déploiement directement dans l'onglet "Actions" de votre dépôt GitHub.*
```
