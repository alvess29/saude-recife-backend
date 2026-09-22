const fs = require('fs');
const path = require('path');
require('dotenv').config();
const admin = require('firebase-admin');

const RAIZ_BACKEND = path.resolve(__dirname, '..', '..');

function resolverCaminhoCredencial() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return path.isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      ? process.env.GOOGLE_APPLICATION_CREDENTIALS
      : path.join(RAIZ_BACKEND, process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }
  return path.join(RAIZ_BACKEND, 'serviceAccountKey.json');
}

function carregarCredencial() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    return admin.credential.cert(serviceAccount);
  }

  const caminho = resolverCaminhoCredencial();

  if (!fs.existsSync(caminho)) {
    console.error('\n===========================================================');
    console.error('ERRO: credenciais do Firebase nao encontradas.');
    console.error('===========================================================');
    console.error(`Procurei o arquivo em: ${caminho}`);
    console.error('\nComo resolver:');
    console.error('  1. No Console do Firebase, va em');
    console.error('     Configuracoes do projeto > Contas de servico');
    console.error('  2. Clique em "Gerar nova chave privada" e baixe o JSON.');
    console.error('  3. Renomeie o arquivo para "serviceAccountKey.json"');
    console.error(`  4. Coloque-o em: ${RAIZ_BACKEND}`);
    console.error('     (a mesma pasta onde fica o package.json do backend)');
    console.error('===========================================================\n');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(caminho, 'utf-8'));
  return admin.credential.cert(serviceAccount);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: carregarCredencial() });
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
