const express = require('express');
const router = express.Router();
const { autenticar, permitir } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

router.post('/registrar-paciente', ctrl.registrarPaciente);
router.post('/registrar-equipe', autenticar, permitir('administrador'), ctrl.registrarContaEquipe);
router.post('/resolver-login', ctrl.resolverLogin);
router.get('/perfil', autenticar, ctrl.perfilAtual);
router.put('/perfil', autenticar, permitir('paciente'), ctrl.atualizarPerfilPaciente);
router.get('/pacientes', autenticar, permitir('administrador'), ctrl.listarPacientes);

module.exports = router;
