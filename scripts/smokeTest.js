
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_SENHA = process.env.ADMIN_SENHA;

const OK = '\x1b[32m✔\x1b[0m';
const FALHA = '\x1b[31m✘\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';

let passos = 0;
let falhas = 0;

function checarEnv() {
  const faltando = [];
  if (!FIREBASE_API_KEY) faltando.push('FIREBASE_API_KEY');
  if (!ADMIN_EMAIL) faltando.push('ADMIN_EMAIL');
  if (!ADMIN_SENHA) faltando.push('ADMIN_SENHA');
  if (faltando.length) {
    console.error(`${FALHA} Variaveis de ambiente ausentes: ${faltando.join(', ')}`);
    console.error('Veja o cabecalho deste arquivo para o modo de uso.');
    process.exit(1);
  }
}

async function loginFirebase(email, senha) {
  const resposta = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
    }
  );
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.error?.message || 'Falha no login Firebase.');
  return dados.idToken;
}

async function api(caminho, { metodo = 'GET', corpo, token } = {}) {
  const resposta = await fetch(`${API_BASE_URL}${caminho}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || `HTTP ${resposta.status}`);
  return dados;
}

async function passo(descricao, funcao) {
  passos += 1;
  try {
    const resultado = await funcao();
    console.log(`${OK} ${descricao}`);
    return resultado;
  } catch (erro) {
    falhas += 1;
    console.log(`${FALHA} ${descricao}`);
    console.log(`   -> ${erro.message}`);
    throw erro;
  }
}

async function main() {
  checarEnv();
  console.log(`${INFO} Testando API em ${API_BASE_URL}\n`);

  const sufixo = Date.now();

  await passo('Servidor respondendo (GET /saude)', () => api('/saude'));

  const tokenAdmin = await passo('Login como administrador', () => loginFirebase(ADMIN_EMAIL, ADMIN_SENHA));

  const especialidade = await passo('Cadastrar especialidade de teste', () =>
    api('/especialidades', { metodo: 'POST', token: tokenAdmin, corpo: { nome: `Ortopedia teste ${sufixo}` } })
  );

  const clinica = await passo('Cadastrar clinica de teste', () =>
    api('/clinicas', {
      metodo: 'POST',
      token: tokenAdmin,
      corpo: {
        nome: `Clinica Teste ${sufixo}`,
        cnpj: `00.000.000/0001-${sufixo % 100}`,
        endereco: 'Rua de Teste, 123',
        telefone: '(81) 90000-0000',
        email: `clinica${sufixo}@teste.com`,
      },
    })
  );

  const profissional = await passo('Cadastrar profissional de teste', () =>
    api('/profissionais', {
      metodo: 'POST',
      token: tokenAdmin,
      corpo: {
        nome: `Dr(a). Teste ${sufixo}`,
        cpf: `${sufixo}`.slice(0, 11).padEnd(11, '0'),
        registroProfissional: `CRM-${sufixo}`,
        conselho: 'CRM',
        ufRegistro: 'PE',
        especialidadeIds: [especialidade.id],
        clinicaIds: [clinica.id],
      },
    })
  );

  const depoisDeAmanha = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const disponibilidade = await passo('Cadastrar horario disponivel', () =>
    api('/disponibilidades', {
      metodo: 'POST',
      token: tokenAdmin,
      corpo: {
        profissionalId: profissional.id,
        clinicaId: clinica.id,
        data: depoisDeAmanha,
        horaInicio: '09:00',
        horaFim: '09:30',
        duracaoMinutos: 30,
      },
    })
  );

  const emailPaciente = `paciente.teste.${sufixo}@exemplo.com`;
  await passo('Cadastrar paciente de teste', () =>
    api('/auth/registrar-paciente', {
      metodo: 'POST',
      corpo: { nome: 'Paciente Teste', email: emailPaciente, senha: 'SenhaTeste123', cpf: `${sufixo}` },
    })
  );

  const tokenPaciente = await passo('Login como paciente', () => loginFirebase(emailPaciente, 'SenhaTeste123'));

  await passo('Consultar horarios disponiveis (filtrado por especialidade)', async () => {
    const lista = await api(`/disponibilidades?especialidadeId=${especialidade.id}`, { token: tokenPaciente });
    if (!lista.find((h) => h.id === disponibilidade.id)) throw new Error('Horario cadastrado nao apareceu na busca.');
  });

  const agendamento = await passo('Agendar consulta', () =>
    api('/agendamentos', {
      metodo: 'POST',
      token: tokenPaciente,
      corpo: { disponibilidadeId: disponibilidade.id, especialidadeId: especialidade.id },
    })
  );

  await passo('Listar "meus agendamentos" (paciente)', async () => {
    const lista = await api('/agendamentos', { token: tokenPaciente });
    if (!lista.find((a) => a.id === agendamento.id)) throw new Error('Agendamento nao apareceu na listagem do paciente.');
  });

  await passo('Administrador ve o agendamento no gerenciamento geral', async () => {
    const lista = await api('/agendamentos', { token: tokenAdmin });
    if (!lista.find((a) => a.id === agendamento.id)) throw new Error('Agendamento nao apareceu na listagem do admin.');
  });

  await passo('Horario fica "reservado" apos o agendamento', async () => {
    const disponiveis = await api(`/disponibilidades?profissionalId=${profissional.id}&status=disponivel`, { token: tokenAdmin });
    if (disponiveis.find((h) => h.id === disponibilidade.id)) throw new Error('Horario ainda aparece como disponivel.');
  });

  await passo('Cancelar agendamento', () =>
    api(`/agendamentos/${agendamento.id}/cancelar`, { metodo: 'PATCH', token: tokenPaciente })
  );

  await passo('Horario volta a ficar "disponivel" apos cancelamento', async () => {
    const disponiveis = await api(`/disponibilidades?profissionalId=${profissional.id}&status=disponivel`, { token: tokenAdmin });
    if (!disponiveis.find((h) => h.id === disponibilidade.id)) throw new Error('Horario nao voltou a ficar disponivel.');
  });

  console.log(`\n${INFO} Concluido: ${passos - falhas}/${passos} passos ok.`);
  if (falhas > 0) process.exit(1);
}

main().catch(() => {
  console.log(`\n${INFO} Teste interrompido apos falha. ${passos - falhas}/${passos} passos ok.`);
  process.exit(1);
});
