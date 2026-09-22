const express = require('express');
const router = express.Router();
const { autenticar, permitir } = require('../middleware/auth');
const ctrl = require('../controllers/disponibilidadeController');

router.get('/', autenticar, ctrl.listar);

router.post('/', autenticar, permitir('administrador', 'profissional'), ctrl.cadastrar);
router.delete('/:id', autenticar, permitir('administrador', 'profissional'), ctrl.remover);

module.exports = router;
