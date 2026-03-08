const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

// Récupération des secrets locaux
const env = JSON.parse(fs.readFileSync('environnement.json', 'utf8'));
const token = env.GITHUB_PERSONAL_ACCESS_TOKEN;
const cloudflareToken = env.CLOUDFLARE_API_TOKEN;
const repo = 'patience2015/claims';

if (!cloudflareToken) {
    console.log("CLOUDFLARE_API_TOKEN est absent. Fin.");
    process.exit(0);
}

const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'NodeJS-Script'
};

// Fonction pour récupérer la clé publique du repo GitHub
function getPublicKey() {
    return new Promise((resolve, reject) => {
        https.get(`https://api.github.com/repos/${repo}/actions/secrets/public-key`, { headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

// Pour simplifier et éviter libsodium.js (qui require NPM), on va demander à l'utilisateur de valider l'interface.
console.log("== MODE MANUEL REQUIS ==");
console.log("L'API de GitHub Actions exige un cryptage libsodium qui n'est pas dispo nativement sans npm install.");
console.log("Veuillez aller sur : https://github.com/patience2015/claims/settings/secrets/actions");
console.log("Et ajouter :");
console.log("Nom : CLOUDFLARE_API_TOKEN");
console.log("Valeur : " + cloudflareToken);
