const { db } = require('../config/firebase');
const { DISPONIBILIDADES, PROFISSIONAIS } = require('../config/collections');
const { agoraNoFuso, horarioJaPassou } = require('../utils/fusoHorario');

function paraMinutos(horario) {
  const [hora, minuto] = horario.split(':').map(Number);
  return hora * 60 + minuto;
}

function paraHorario(minutos) {
  const hora = String(Math.floor(minutos / 60)).padStart(2, '0');
  const minuto = String(minutos % 60).padStart(2, '0');
  return `${hora}:${minuto}`;
}

async function cadastrar(req, res) {
  const { profissionalId, clinicaId, data, horaInicio, horaFim, duracaoMinutos } = req.body;

  if (!profissionalId || !clinicaId || !data || !horaInicio || !horaFim) {
    return res.status(400).json({ erro: 'profissionalId, clinicaId, data, horaInicio e horaFim são obrigatórios.' });
  }

  try {
    const profissionalDoc = await db.collection(PROFISSIONAIS).doc(profissionalId).get();
    if (!profissionalDoc.exists) {
      return res.status(404).json({ erro: 'Profissional não encontrado.' });
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

    const hoje = agoraNoFuso().data;
    itens = itens.filter((item) => item.data >= hoje && !(item.status === 'disponivel' && horarioJaPassou(item)));

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
    res.status(500).json({ erro: 'Erro ao consultar horários disponíveis.' });
  }
}

async function remover(req, res) {
  try {
    const ref = db.collection(DISPONIBILIDADES).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ erro: 'Disponibilidade não encontrada.' });
    if (doc.data().status === 'reservado') {
      return res.status(409).json({ erro: 'Não é possível remover um horário já reservado.' });
    }
    await ref.delete();
    res.json({ mensagem: 'Disponibilidade removida.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao remover disponibilidade.' });
  }
}

async function cadastrarLote(req, res) {
  const { profissionalId, clinicaId, dias, horaInicio, horaFim, duracaoMinutos } = req.body;

  if (!profissionalId || !clinicaId || !Array.isArray(dias) || !dias.length || !horaInicio || !horaFim) {
    return res.status(400).json({ erro: 'profissionalId, clinicaId, dias, horaInicio e horaFim são obrigatórios.' });
  }

  const duracao = duracaoMinutos || 30;
  const inicioMin = paraMinutos(horaInicio);
  const fimMin = paraMinutos(horaFim);

  if (fimMin - inicioMin < duracao) {
    return res.status(400).json({ erro: 'O intervalo informado é menor que a duração de cada horário.' });
  }

  try {
    const profissionalDoc = await db.collection(PROFISSIONAIS).doc(profissionalId).get();
    if (!profissionalDoc.exists) {
      return res.status(404).json({ erro: 'Profissional não encontrado.' });
    }

    const lote = db.batch();
    let total = 0;

    dias.forEach((data) => {
      for (let minuto = inicioMin; minuto + duracao <= fimMin; minuto += duracao) {
        const ref = db.collection(DISPONIBILIDADES).doc();
        lote.set(ref, {
          profissionalId,
          clinicaId,
          data,
          horaInicio: paraHorario(minuto),
          horaFim: paraHorario(minuto + duracao),
          duracaoMinutos: duracao,
          status: 'disponivel',
          criadoEm: new Date().toISOString(),
        });
        total += 1;
      }
    });

    await lote.commit();
    res.status(201).json({ mensagem: `${total} horários criados.`, total });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao cadastrar horários em lote.' });
  }
}

module.exports = { cadastrar, listar, remover, cadastrarLote };
