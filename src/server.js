require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./modules/auth/auth.routes');
const clinicasRoutes = require('./modules/clinicas/clinicas.routes');
const especialidadesRoutes = require('./modules/especialidades/especialidades.routes');
const profissionaisRoutes = require('./modules/profissionais/profissionais.routes');
const disponibilidadesRoutes = require('./modules/disponibilidades/disponibilidades.routes');
const agendamentosRoutes = require('./modules/agendamentos/agendamentos.routes');
const triagemRoutes = require('./modules/triagem/triagem.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/saude', (req, res) => res.json({ status: 'ok', servico: 'Saude Recife API' }));

app.use('/api/auth', authRoutes);
app.use('/api/clinicas', clinicasRoutes);
app.use('/api/especialidades', especialidadesRoutes);
app.use('/api/profissionais', profissionaisRoutes);
app.use('/api/disponibilidades', disponibilidadesRoutes);
app.use('/api/agendamentos', agendamentosRoutes);
app.use('/api/triagem', triagemRoutes);

app.use((req, res) => res.status(404).json({ erro: 'Rota nao encontrada.' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API Saude Recife rodando em http://localhost:${PORT}`));
