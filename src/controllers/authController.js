const { auth, db } = require('../config/firebase');
const { USUARIOS, PACIENTES, PROFISSIONAIS } = require('../config/collections');

function somenteDigitos(texto) {
  return String(texto || '').replace(/\D/g, '');
}

async function registrarPaciente(req, res) {
  const { nome, email, senha, telefone, cpf, dataNascimento, sexo, observacoes } = req.body;

  if (!nome || !email || !senha || !cpf) {
    return res.status(400).json({ erro: 'nome, email, senha e cpf sao obrigatorios.' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const cpfNormalizado = somenteDigitos(cpf);
  if (cpfNormalizado.length !== 11) {
    return res.status(400).json({ erro: 'CPF invalido. Informe os 11 digitos.' });
  }

  try {
    const cpfEmUso = await db.collection(PACIENTES).where('cpf', '==', cpfNormalizado).limit(1).get();
    if (!cpfEmUso.empty) {
      return res.status(409).json({ erro: 'Ja existe uma conta com este CPF.' });
    }

    const usuarioFirebase = await auth.createUser({ email, password: senha, displayName: nome });

    const perfilUsuario = {
      nome,
      email,
      telefone: telefone || '',
      tipoUsuario: 'paciente',
      ativo: true,
      criadoEm: new Date().toISOString(),
    };
    await db.collection(USUARIOS).doc(usuarioFirebase.uid).set(perfilUsuario);

    const perfilPaciente = {
      uid: usuarioFirebase.uid,
      cpf: cpfNormalizado,
      dataNascimento: dataNascimento || null,
      sexo: sexo || null,
      observacoes: observacoes || '',
    };
    await db.collection(PACIENTES).doc(usuarioFirebase.uid).set(perfilPaciente);

    res.status(201).json({
      mensagem: 'Paciente cadastrado com sucesso.',
      usuario: { uid: usuarioFirebase.uid, ...perfilUsuario },
      paciente: perfilPaciente,
    });
  } catch (erro) {
    console.error(erro);
    if (erro.code === 'auth/email-already-exists') {
      return res.status(409).json({ erro: 'Ja existe uma conta com este e-mail.' });
    }
    res.status(500).json({ erro: 'Erro ao cadastrar paciente.' });
  }
}

async function registrarContaEquipe(req, res) {
  const { nome, email, senha, tipoUsuario, profissionalId } = req.body;

  if (!['profissional', 'administrador'].includes(tipoUsuario)) {
    return res.status(400).json({ erro: 'tipoUsuario deve ser "profissional" ou "administrador".' });
  }
  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'nome, email e senha sao obrigatorios.' });
  }

  try {
    const usuarioFirebase = await auth.createUser({ email, password: senha, displayName: nome });

    const perfilUsuario = {
      nome,
      email,
      tipoUsuario,
      profissionalId: profissionalId || null,
      ativo: true,
      criadoEm: new Date().toISOString(),
    };
    await db.collection(USUARIOS).doc(usuarioFirebase.uid).set(perfilUsuario);

    if (tipoUsuario === 'profissional' && profissionalId) {
      const { PROFISSIONAIS } = require('../config/collections');
      await db.collection(PROFISSIONAIS).doc(profissionalId).update({ uid: usuarioFirebase.uid });
    }

    res.status(201).json({ mensagem: 'Conta criada com sucesso.', usuario: { uid: usuarioFirebase.uid, ...perfilUsuario } });
  } catch (erro) {
    console.error(erro);
    if (erro.code === 'auth/email-already-exists') {
      return res.status(409).json({ erro: 'Ja existe uma conta com este e-mail.' });
    }
    res.status(500).json({ erro: 'Erro ao criar conta.' });
  }
}

async function resolverLogin(req, res) {
  const { identificador } = req.body;

  if (!identificador) {
    return res.status(400).json({ erro: 'Informe o e-mail ou CPF.' });
  }

  if (identificador.includes('@')) {
    return res.json({ email: identificador.trim() });
  }

  const cpfNormalizado = somenteDigitos(identificador);
  if (cpfNormalizado.length !== 11) {
    return res.status(400).json({ erro: 'CPF invalido.' });
  }

  try {
    const pacienteSnap = await db.collection(PACIENTES).where('cpf', '==', cpfNormalizado).limit(1).get();
    if (!pacienteSnap.empty) {
      const usuarioDoc = await db.collection(USUARIOS).doc(pacienteSnap.docs[0].id).get();
      if (usuarioDoc.exists) return res.json({ email: usuarioDoc.data().email });
    }

    const profissionalSnap = await db.collection(PROFISSIONAIS).where('cpf', '==', cpfNormalizado).limit(1).get();
    if (!profissionalSnap.empty && profissionalSnap.docs[0].data().uid) {
      const usuarioDoc = await db.collection(USUARIOS).doc(profissionalSnap.docs[0].data().uid).get();
      if (usuarioDoc.exists) return res.json({ email: usuarioDoc.data().email });
    }

    res.status(404).json({ erro: 'Nao encontramos uma conta com este CPF.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao consultar CPF.' });
  }
}

async function listarPacientes(req, res) {
  try {
    const usuariosSnap = await db.collection(USUARIOS).where('tipoUsuario', '==', 'paciente').get();

    const pacientes = await Promise.all(
      usuariosSnap.docs.map(async (usuarioDoc) => {
        const pacienteDoc = await db.collection(PACIENTES).doc(usuarioDoc.id).get();
        return {
          uid: usuarioDoc.id,
          ...usuarioDoc.data(),
          ...(pacienteDoc.exists ? pacienteDoc.data() : {}),
        };
      })
    );

    pacientes.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    res.json(pacientes);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar pacientes.' });
  }
}
async function perfilAtual(req, res) {
  try {
    const { uid, tipoUsuario } = req.usuario;
    let dadosExtra = {};

    if (tipoUsuario === 'paciente') {
      const doc = await db.collection(PACIENTES).doc(uid).get();
      dadosExtra = doc.exists ? doc.data() : {};
    }

    res.json({ ...req.usuario, ...dadosExtra });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao carregar perfil.' });
  }
}

async function atualizarPerfilPaciente(req, res) {
  try {
    const { uid } = req.usuario;
    const { nome, telefone, dataNascimento, sexo, observacoes } = req.body;

    if (nome || telefone) {
      await db.collection(USUARIOS).doc(uid).update({
        ...(nome && { nome }),
        ...(telefone && { telefone }),
      });
    }
    await db.collection(PACIENTES).doc(uid).update({
      ...(dataNascimento && { dataNascimento }),
      ...(sexo && { sexo }),
      ...(observacoes !== undefined && { observacoes }),
    });

    res.json({ mensagem: 'Perfil atualizado com sucesso.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar perfil.' });
  }
}

module.exports = {
  registrarPaciente,
  registrarContaEquipe,
  perfilAtual,
  atualizarPerfilPaciente,
  resolverLogin,
  listarPacientes,
};
