const criarCrud = require('../../utils/crudFactory');
const { PROFISSIONAIS } = require('../../config/collections');

module.exports = criarCrud(PROFISSIONAIS, {
  camposObrigatorios: ['nome', 'cpf', 'registroProfissional', 'conselho'],
});
