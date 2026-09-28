const FUSO_HORARIO = 'America/Recife';

// O servidor pode rodar em UTC, mas os horários cadastrados são os de Recife.
function agoraNoFuso() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_HORARIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const valor = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return { data: `${valor.year}-${valor.month}-${valor.day}`, hora: `${valor.hour}:${valor.minute}` };
}

function horarioJaPassou({ data, horaInicio }) {
  const agora = agoraNoFuso();
  return data < agora.data || (data === agora.data && horaInicio <= agora.hora);
}

module.exports = { agoraNoFuso, horarioJaPassou };
