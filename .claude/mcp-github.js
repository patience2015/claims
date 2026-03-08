#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../environnement.json');
let envData = {};
try {
    if (fs.existsSync(envPath)) {
        envData = JSON.parse(fs.readFileSync(envPath, 'utf8'));
    }
} catch (err) {
    console.error('Erreur lors de la lecture de environnement.json:', err.message);
}

const env = { ...process.env, ...envData };

const child = spawn('npx', ['-y', '@modelcontextprotocol/server-github'], {
    stdio: 'inherit',
    env,
    shell: true // on windows npx needs shell: true
});

child.on('error', (err) => {
    console.error('Erreur lancement MCP GitHub:', err);
});

child.on('exit', (code) => {
    process.exit(code || 0);
});
