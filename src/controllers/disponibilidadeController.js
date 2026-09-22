const { db } = require('../config/firebase');
const { DISPONIBILIDADES, PROFISSIONAIS } = require('../config/collections');

async function cadastrar(req, res) {
  const { profissionalId, clinicaId, data, horaInicio, horaFim, duracaoMinutos } = req.body;

  if (!profissionalId || !clinicaId || !data || !horaInicio || !horaFim) {
    return res.status(400).json({ erro: 'profissionalId, clinicaId, data, horaInicio e horaFim sao obrigatorios.' });
  }

  try {
    const profissionalDoc = await db.collection(PROFISSIONAIS).doc(profissionalId).get();
    if (!profissionalDoc.exists) {
      return res.status(404).json({ erro: 'Profissional nao encontrado.' });
    }

    const disponibilidade = {
      profissionalId,
      clinicaId,
      data,
      horaInicio,
      horaFim,
      duracaoMinutos: duracaoMinutos || 30,
      status: 'disponivel',
      criadoEm: new Date().toISOString(),
    };

    const ref = await db.collection(DISPONIBILIDADES).add(disponibilidade);
    res.status(201).json({ id: ref.id, ...disponibilidade });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao cadastrar disponibilidade.' });
  }
}

async function listar(req, res) {
  try {
    const { profissionalId, clinicaId, especialidadeId, status } = req.query;
    let query = db.collection(DISPONIBILIDADES);

    if (profissionalId) query = query.where('profissionalId', '==', profissionalId);
    if (clinicaId) query = query.where('clinicaId', '==', clinicaId);
    query = query.where('status', '==', status || 'disponivel');

    const snap = await query.get();
    let itens = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    
    if (especialidadeId) {
      const profissionaisSnap = await db
        .collection(PROFISSIONAIS)
        .where('especialidadeIds', 'array-contains', especialidadeId)
        .get();
      const idsPermitidos = new Set(profissionaisSnap.docs.map((d) => d.id));
      itens = itens.filter((item) => idsPermitidos.has(item.profissionalId));
    }

    itens.sort((a, b) => `${a.data}${a.horaInicio}`.localeCompare(`${b.data}${b.horaInicio}`));
    res.json(itens);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao consultar horarios disponiveis.' });
  }
}

async function remover(req, res) {
  try {
    const ref = db.collection(DISPONIBILIDADES).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ erro: 'Disponibilidade nao encontrada.' });
    if (doc.data().status === 'reservado') {
      return res.status(409).json({ erro: 'Nao e possivel remover um horario ja reservado.' });
    }
    await ref.delete();
    res.json({ mensagem: 'Disponibilidade removida.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao remover disponibilidade.' });
  }
}

module.exports = { cadastrar, listar, remover };
