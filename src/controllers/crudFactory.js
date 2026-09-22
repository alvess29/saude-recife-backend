const { db } = require('../config/firebase');

function criarCrud(nomeColecao, { camposObrigatorios = [] } = {}) {
  const colecao = () => db.collection(nomeColecao);

  function validar(body) {
    const faltando = camposObrigatorios.filter((campo) => {
      const valor = body[campo];
      return valor === undefined || valor === null || valor === '';
    });
    return faltando;
  }

  return {
    async listar(req, res) {
      try {
        let query = colecao();
        if (req.query.ativo !== undefined) {
          query = query.where('ativo', '==', req.query.ativo === 'true');
        }
        const snap = await query.get();
        const itens = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        res.json(itens);
      } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao listar registros.' });
      }
    },

    async obter(req, res) {
      try {
        const doc = await colecao().doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ erro: 'Registro nao encontrado.' });
        res.json({ id: doc.id, ...doc.data() });
      } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao buscar registro.' });
      }
    },

    async criar(req, res) {
      try {
        const faltando = validar(req.body);
        if (faltando.length) {
          return res.status(400).json({ erro: `Campos obrigatorios ausentes: ${faltando.join(', ')}` });
        }
        const dados = { ...req.body, ativo: req.body.ativo ?? true, criadoEm: new Date().toISOString() };
        const ref = await colecao().add(dados);
        res.status(201).json({ id: ref.id, ...dados });
      } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao criar registro.' });
      }
    },

    async atualizar(req, res) {
      try {
        const ref = colecao().doc(req.params.id);
        const doc = await ref.get();
        if (!doc.exists) return res.status(404).json({ erro: 'Registro nao encontrado.' });
        const dados = { ...req.body, atualizadoEm: new Date().toISOString() };
        await ref.update(dados);
        res.json({ id: doc.id, ...doc.data(), ...dados });
      } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao atualizar registro.' });
      }
    },

    async remover(req, res) {
      try {
        const ref = colecao().doc(req.params.id);
        const doc = await ref.get();
        if (!doc.exists) return res.status(404).json({ erro: 'Registro nao encontrado.' });
        
        await ref.update({ ativo: false, removidoEm: new Date().toISOString() });
        res.json({ mensagem: 'Registro desativado com sucesso.' });
      } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao remover registro.' });
      }
    },

    async removerDefinitivo(req, res) {
      try {
        const ref = colecao().doc(req.params.id);
        const doc = await ref.get();
        if (!doc.exists) return res.status(404).json({ erro: 'Registro nao encontrado.' });
        await ref.delete();
        res.json({ mensagem: 'Registro excluido permanentemente.' });
      } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: 'Erro ao excluir registro.' });
      }
    },
  };
}

module.exports = criarCrud;
