const express = require('express');
const router = express.Router();
const { autenticar, permitir } = require('../../middleware/auth');
const ctrl = require('./profissionais.controller');

router.get('/', autenticar, ctrl.listar);
router.get('/:id', autenticar, ctrl.obter);

router.post('/', autenticar, permitir('administrador'), ctrl.criar);
router.put('/:id', autenticar, permitir('administrador'), ctrl.atualizar);
router.delete('/:id', autenticar, permitir('administrador'), ctrl.remover);
router.delete('/:id/permanente', autenticar, permitir('administrador'), ctrl.removerDefinitivo);

module.exports = router;
