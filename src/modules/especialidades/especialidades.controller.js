const criarCrud = require('../../utils/crudFactory');
const { ESPECIALIDADES } = require('../../config/collections');

module.exports = criarCrud(ESPECIALIDADES, { camposObrigatorios: ['nome'] });
