const { auth, db } = require('../src/config/firebase');
const { USUARIOS } = require('../src/config/collections');

async function main() {
  const [, , nome, email, senha] = process.argv;

  if (!nome || !email || !senha) {
    console.error('Uso: node scripts/criarAdmin.js "Nome" email@exemplo.com senha');
    process.exit(1);
  }

  const usuarioFirebase = await auth.createUser({ email, password: senha, displayName: nome });

  await db.collection(USUARIOS).doc(usuarioFirebase.uid).set({
    nome,
    email,
    tipoUsuario: 'administrador',
    ativo: true,
    criadoEm: new Date().toISOString(),
  });

  console.log(`Administrador criado com sucesso! uid: ${usuarioFirebase.uid}`);
  process.exit(0);
}

main().catch((erro) => {
  console.error('Erro ao criar administrador:', erro.message);
  process.exit(1);
});
