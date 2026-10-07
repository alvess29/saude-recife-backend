const { db } = require('../../config/firebase');
const { AGENDAMENTOS, DISPONIBILIDADES } = require('../../config/collections');
const { horarioJaPassou, agoraIsoNoFuso, subtrairMinutos } = require('../../utils/fusoHorario');

const ANTECEDENCIA_CANCELAMENTO_MINUTOS = 24 * 60;

function prazoParaCancelar(agendamento) {
  return subtrairMinutos(agendamento.dataHora, ANTECEDENCIA_CANCELAMENTO_MINUTOS);
}

function dentroDoPrazo(agendamento) {
  return agoraIsoNoFuso() <= prazoParaCancelar(agendamento);
}

function regraDeCancelamento(agendamento, tipoUsuario) {
  if (agendamento.status !== 'confirmado') return { podeCancelar: false };
  const cancelavelAte = prazoParaCancelar(agendamento);
  const podeCancelar = tipoUsuario === 'administrador' || (tipoUsuario === 'paciente' && dentroDoPrazo(agendamento));
  return { podeCancelar, cancelavelAte };
}

async function criar(req, res) {
  const { disponibilidadeId, especialidadeId, observacao } = req.body;
  const pacienteId = req.usuario.uid;

  if (!disponibilidadeId) {
    return res.status(400).json({ erro: 'disponibilidadeId e obrigatorio.' });
  }

  try {
    const resultado = await db.runTransaction(async (tx) => {
      const dispoRef = db.collection(DISPONIBILIDADES).doc(disponibilidadeId);
      const dispoDoc = await tx.get(dispoRef);

      if (!dispoDoc.exists) throw { status: 404, mensagem: 'Horario nao encontrado.' };
      const dispo = dispoDoc.data();
      if (dispo.status !== 'disponivel') throw { status: 409, mensagem: 'Este horario ja nao esta mais disponivel.' };
      if (horarioJaPassou(dispo)) throw { status: 409, mensagem: 'Este horario ja passou.' };

      const agendamento = {
        pacienteId,
        pacienteNome: req.usuario.nome || 'Paciente',
        pacienteTelefone: req.usuario.telefone || '',
        profissionalId: dispo.profissionalId,
        clinicaId: dispo.clinicaId,
        especialidadeId: especialidadeId || null,
        disponibilidadeId,
        dataHora: `${dispo.data}T${dispo.horaInicio}`,
        status: 'confirmado',
        observacao: observacao || '',
        criadoEm: new Date().toISOString(),
      };

      const agendamentoRef = db.collection(AGENDAMENTOS).doc();
      tx.set(agendamentoRef, agendamento);
      tx.update(dispoRef, { status: 'reservado' });

      return { id: agendamentoRef.id, ...agendamento };
    });

    res.status(201).json(resultado);
  } catch (erro) {
    if (erro.status) return res.status(erro.status).json({ erro: erro.mensagem });
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao agendar consulta.' });
  }
}

async function listar(req, res) {
  try {
    const { uid, tipoUsuario } = req.usuario;
    let query = db.collection(AGENDAMENTOS);

    if (tipoUsuario === 'paciente') {
      query = query.where('pacienteId', '==', uid);
    } else if (tipoUsuario === 'profissional') {
      const { PROFISSIONAIS } = require('../../config/collections');
      const profDoc = await db.collection(PROFISSIONAIS).where('uid', '==', uid).limit(1).get();
      if (profDoc.empty) return res.json([]);
      query = query.where('profissionalId', '==', profDoc.docs[0].id);
    }
    

    const snap = await query.get();
    const itens = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .map((agendamento) => ({ ...agendamento, ...regraDeCancelamento(agendamento, tipoUsuario) }))
      .sort((a, b) => a.dataHora.localeCompare(b.dataHora));
    res.json(itens);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar agendamentos.' });
  }
}

async function cancelar(req, res) {
  const { id } = req.params;
  const { uid, tipoUsuario } = req.usuario;

  try {
    await db.runTransaction(async (tx) => {
      const agendamentoRef = db.collection(AGENDAMENTOS).doc(id);
      const agendamentoDoc = await tx.get(agendamentoRef);

      if (!agendamentoDoc.exists) throw { status: 404, mensagem: 'Agendamento nao encontrado.' };
      const agendamento = agendamentoDoc.data();

      const podeCancelar = tipoUsuario === 'administrador' || agendamento.pacienteId === uid;
      if (!podeCancelar) throw { status: 403, mensagem: 'Voce nao pode cancelar este agendamento.' };
      if (agendamento.status === 'cancelado') throw { status: 409, mensagem: 'Agendamento ja esta cancelado.' };
      if (tipoUsuario !== 'administrador' && !dentroDoPrazo(agendamento)) {
        const horas = ANTECEDENCIA_CANCELAMENTO_MINUTOS / 60;
        throw { status: 409, mensagem: `O cancelamento so e permitido ate ${horas} horas antes da consulta. Entre em contato com a clinica.` };
      }

      tx.update(agendamentoRef, { status: 'cancelado', canceladoEm: new Date().toISOString() });

      if (agendamento.disponibilidadeId) {
        const dispoRef = db.collection(DISPONIBILIDADES).doc(agendamento.disponibilidadeId);
        tx.update(dispoRef, { status: 'disponivel' });
      }
    });

    res.json({ mensagem: 'Agendamento cancelado com sucesso.' });
  } catch (erro) {
    if (erro.status) return res.status(erro.status).json({ erro: erro.mensagem });
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao cancelar agendamento.' });
  }
}

module.exports = { criar, listar, cancelar };
