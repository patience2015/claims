const fs = require('fs');
const { execSync } = require('child_process');

try {
    const env = JSON.parse(fs.readFileSync('environnement.json', 'utf8'));
    const token = env.GITHUB_PERSONAL_ACCESS_TOKEN;

    if (!token) {
        throw new Error('Token GITHUB_PERSONAL_ACCESS_TOKEN manquant dans environnement.json');
    }

    const url = `https://${token}@github.com/patience2015/claims.git`;

    console.log("Exécution du git push en cours...");
    // On pousse vers l'URL contenant le nouveau credentials sans remplacer le remote global
    execSync(`git push -f ${url} main`, { stdio: 'inherit' });

    console.log("✅ Push forcé terminé avec succès via le nouveau token !");
} catch (e) {
    console.error("❌ Erreur lors du push:", e.message);
}
