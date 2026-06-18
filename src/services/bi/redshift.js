const path = require("path");
const { Pool } = require("pg");

// Compatibilidade durante a incorporação do BI GPM. Variáveis já presentes no
// .env principal continuam tendo prioridade.
require("dotenv").config({ path: path.resolve(__dirname, "../../../BI GPM/.env"), quiet: true });

const redshift = new Pool({
  host: process.env.REDSHIFT_HOST,
  port: Number(process.env.REDSHIFT_PORT || 5439),
  database: process.env.REDSHIFT_DATABASE,
  user: process.env.REDSHIFT_USER,
  password: process.env.REDSHIFT_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  statement_timeout: 120000,
  query_timeout: 120000,
  keepAlive: true
});

module.exports = redshift;
