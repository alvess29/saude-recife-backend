const criarCrud = require('../../utils/crudFactory');
const { CLINICAS } = require('../../config/collections');

module.exports = criarCrud(CLINICAS, {
  camposObrigatorios: ['nome', 'cnpj', 'endereco', 'telefone', 'email'],
});
