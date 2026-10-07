const express = require('express');
const router = express.Router();
const { autenticar, permitir } = require('../../middleware/auth');
const ctrl = require('./triagem.controller');

router.post('/', autenticar, permitir('paciente'), ctrl.conversar);

module.exports = router;
