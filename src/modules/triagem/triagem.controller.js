const { db } = require('../../config/firebase');
const { ESPECIALIDADES } = require('../../config/collections');

const MODELO = 'gemini-3.6-flash';

const PROMPT_BASE = `Você é o assistente de pré-triagem do Saúde Recife, um sistema de agendamento de consultas médicas.

Sua função é fazer poucas perguntas objetivas sobre os sintomas do paciente (no máximo 4 perguntas, uma de cada vez) e, ao final, recomendar qual especialidade da lista abaixo é a mais indicada para o caso. Você não faz diagnóstico nem prescreve tratamento, apenas ajuda a direcionar o paciente para o profissional certo.

Especialidades disponíveis neste sistema:
{{ESPECIALIDADES}}

Regras importantes:
- Se os sintomas descritos sugerirem uma emergência (dor forte no peito, falta de ar grave, sangramento intenso, sinais de AVC, perda de consciência, ideação suicida, entre outros), interrompa a triagem, oriente o paciente a procurar atendimento de emergência imediatamente (SAMU 192 ou o pronto-socorro mais próximo), e marque "emergencia" como true.
- Recomende sempre um nome de especialidade EXATAMENTE como está na lista acima. Se nenhuma for claramente adequada, recomende "Clínica Geral" caso ela exista na lista, ou deixe especialidadeRecomendada como null.
- Quando "concluido" for true e não houver emergência, a "resposta" deve dizer explicitamente, em linguagem natural, qual especialidade da lista o paciente deve procurar (ex.: "Pelo que você me contou, recomendo que você procure um(a) Cardiologista."). Não deixe essa recomendação subentendida.
- Seja breve, acolhedor e direto, sem jargão médico complexo.
- "concluido" só deve ser true quando você já tiver informação suficiente para recomendar uma especialidade, ou ao identificar uma emergência. Enquanto ainda estiver perguntando, "concluido" deve ser false e "especialidadeRecomendada" deve ser null.

Responda SEMPRE e SOMENTE com um JSON válido, sem nenhum texto fora dele, no formato exato:
{"resposta": "texto que será mostrado ao paciente", "concluido": true ou false, "especialidadeRecomendada": "nome exato da especialidade ou null", "emergencia": true ou false}`;

async function conversar(req, res) {
  const { mensagens } = req.body;

  if (!Array.isArray(mensagens) || !mensagens.length) {
    return res.status(400).json({ erro: 'mensagens é obrigatório e deve ser uma lista.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ erro: 'A pré-triagem por IA não está configurada neste servidor.' });
  }

  try {
    const especialidadesSnap = await db.collection(ESPECIALIDADES).get();
    const especialidadesAtivas = especialidadesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((e) => e.ativo !== false);

    const systemPrompt = PROMPT_BASE.replace(
      '{{ESPECIALIDADES}}',
      especialidadesAtivas.map((e) => `- ${e.nome}`).join('\n')
    );

    const respostaIA = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: mensagens.map((m) => ({
            role: m.papel === 'assistente' ? 'model' : 'user',
            parts: [{ text: m.texto }],
          })),
          generationConfig: {
            maxOutputTokens: 800,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: 'low' },
          },
        }),
      }
    );

    if (!respostaIA.ok) {
      console.error('Erro na API do Gemini:', await respostaIA.text());
      return res.status(502).json({ erro: 'Não foi possível falar com o assistente de triagem agora.' });
    }

    const dados = await respostaIA.json();
    const texto = dados.candidates[0].content.parts.map((p) => p.text || '').join('');
    const resultado = JSON.parse(texto);

    const nomeRecomendado = (resultado.especialidadeRecomendada || '').toLowerCase();
    const especialidade = especialidadesAtivas.find((e) => e.nome.toLowerCase() === nomeRecomendado);

    res.json({
      resposta: resultado.resposta,
      concluido: Boolean(resultado.concluido),
      emergencia: Boolean(resultado.emergencia),
      especialidadeRecomendada: especialidade ? especialidade.nome : null,
      especialidadeId: especialidade ? especialidade.id : null,
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao processar a pré-triagem.' });
  }
}

module.exports = { conversar };
