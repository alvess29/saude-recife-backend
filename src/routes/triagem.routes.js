const express = require('express');
const router = express.Router();
const { autenticar, permitir } = require('../middleware/auth');
const ctrl = require('../controllers/triagemController');

router.post('/', autenticar, permitir('paciente'), ctrl.conversar);

module.exports = router;
