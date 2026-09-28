const { db } = require('../config/firebase');
const { DISPONIBILIDADES, PROFISSIONAIS, AGENDAMENTOS } = require('../config/collections');

function paraMinutos(horario) {
  const [hora, minuto] = horario.split(':').map(Number);
  return hora * 60 + minuto;
}

function paraHorario(minutos) {
  const hora = String(Math.floor(minutos / 60)).padStart(2, '0');
  const minuto = String(minutos % 60).padStart(2, '0');
  return `${hora}:${minuto}`;
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
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

    itens = itens.filter((item) => item.data >= hojeIso());

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

const REGEX_HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

async function ajustarDia(req, res) {
  const { data, horaInicio, horaFim, cancelarAgendamentos } = req.body;
  const ehProfissional = req.usuario.tipoUsuario === 'profissional';
  const profissionalId = ehProfissional ? req.usuario.profissionalId : req.body.profissionalId;

  if (!profissionalId) {
    return res.status(400).json({ erro: 'Profissional não identificado para este ajuste.' });
  }
  if (!data || !REGEX_DATA.test(data)) {
    return res.status(400).json({ erro: 'Informe a data no formato AAAA-MM-DD.' });
  }
  if (data < hojeIso()) {
    return res.status(400).json({ erro: 'Não é possível ajustar um dia que já passou.' });
  }
  if (!horaInicio && !horaFim) {
    return res.status(400).json({ erro: 'Informe o novo horário de início, o de fim, ou os dois.' });
  }
  if ((horaInicio && !REGEX_HORARIO.test(horaInicio)) || (horaFim && !REGEX_HORARIO.test(horaFim))) {
    return res.status(400).json({ erro: 'Horários devem estar no formato HH:MM.' });
  }
  if (horaInicio && horaFim && paraMinutos(horaFim) <= paraMinutos(horaInicio)) {
    return res.status(400).json({ erro: 'O horário de fim deve ser depois do horário de início.' });
  }

  try {
    const snap = await db
      .collection(DISPONIBILIDADES)
      .where('profissionalId', '==', profissionalId)
      .where('data', '==', data)
      .get();

    const foraDoExpediente = snap.docs.filter((doc) => {
      const item = doc.data();
      const antes = horaInicio && paraMinutos(item.horaInicio) < paraMinutos(horaInicio);
      const depois = horaFim && paraMinutos(item.horaFim) > paraMinutos(horaFim);
      return antes || depois;
    });

    const livres = foraDoExpediente.filter((doc) => doc.data().status !== 'reservado');
    const reservados = foraDoExpediente.filter((doc) => doc.data().status === 'reservado');

    let agendamentosAfetados = [];
    if (reservados.length) {
      const idsReservados = new Set(reservados.map((doc) => doc.id));
      const agSnap = await db.collection(AGENDAMENTOS).where('profissionalId', '==', profissionalId).get();
      agendamentosAfetados = agSnap.docs.filter((doc) => {
        const ag = doc.data();
        return ag.status === 'confirmado' && idsReservados.has(ag.disponibilidadeId);
      });

      if (!cancelarAgendamentos) {
        return res.status(409).json({
          erro: `${agendamentosAfetados.length} consulta(s) já marcada(s) ficam fora do novo horário. Confirme para cancelá-las.`,
          agendamentosAfetados: agendamentosAfetados.map((doc) => ({
            id: doc.id,
            pacienteNome: doc.data().pacienteNome,
            dataHora: doc.data().dataHora,
          })),
        });
      }
    }

    const lote = db.batch();
    livres.forEach((doc) => lote.delete(doc.ref));
    reservados.forEach((doc) => lote.delete(doc.ref));
    agendamentosAfetados.forEach((doc) => {
      lote.update(doc.ref, {
        status: 'cancelado',
        canceladoEm: new Date().toISOString(),
        motivoCancelamento: 'Profissional alterou o horário de atendimento do dia.',
      });
    });
    await lote.commit();

    res.json({
      mensagem: 'Horário do dia ajustado.',
      horariosRemovidos: livres.length + reservados.length,
      agendamentosCancelados: agendamentosAfetados.length,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao ajustar o horário do dia.' });
  }
}

module.exports = { cadastrar, listar, remover, cadastrarLote, ajustarDia };
