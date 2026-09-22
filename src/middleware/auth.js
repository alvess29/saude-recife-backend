const { auth, db } = require('../config/firebase');
const { USUARIOS } = require('../config/collections');

async function autenticar(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [, token] = header.split(' ');

    if (!token) {
      return res.status(401).json({ erro: 'Token de autenticacao nao informado.' });
    }

    const decoded = await auth.verifyIdToken(token);
    const perfilSnap = await db.collection(USUARIOS).doc(decoded.uid).get();

    if (!perfilSnap.exists) {
      return res.status(404).json({ erro: 'Perfil de usuario nao encontrado.' });
    }

    req.usuario = { uid: decoded.uid, email: decoded.email, ...perfilSnap.data() };
    next();
  } catch (erro) {
    console.error('Falha na autenticacao:', erro.message);
    return res.status(401).json({ erro: 'Token invalido ou expirado.' });
  }
}

function permitir(...tiposPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ erro: 'Usuario nao autenticado.' });
    }
    if (!tiposPermitidos.includes(req.usuario.tipoUsuario)) {
      return res.status(403).json({ erro: 'Perfil sem permissao para esta operacao.' });
    }
    next();
  };
}

module.exports = { autenticar, permitir };
