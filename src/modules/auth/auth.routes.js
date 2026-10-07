const express = require('express');
const router = express.Router();
const { autenticar, permitir } = require('../../middleware/auth');
const ctrl = require('./auth.controller');

router.post('/registrar-paciente', ctrl.registrarPaciente);
router.post('/registrar-equipe', autenticar, permitir('administrador'), ctrl.registrarContaEquipe);
router.post('/resolver-login', ctrl.resolverLogin);
router.get('/perfil', autenticar, ctrl.perfilAtual);
router.put('/perfil', autenticar, permitir('paciente'), ctrl.atualizarPerfilPaciente);
router.get('/pacientes', autenticar, permitir('administrador'), ctrl.listarPacientes);
router.put('/pacientes/:id', autenticar, permitir('administrador'), ctrl.atualizarPacienteAdmin);

module.exports = router;
