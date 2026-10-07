const express = require('express');
const router = express.Router();
const { autenticar, permitir } = require('../../middleware/auth');
const ctrl = require('./agendamentos.controller');

router.post('/', autenticar, permitir('paciente'), ctrl.criar);
router.get('/', autenticar, ctrl.listar);
router.patch('/:id/cancelar', autenticar, ctrl.cancelar);

module.exports = router;
