require("dotenv").config();
const app = require("./src/app");
const migrate = require("./src/database/migrate");

const PORT = process.env.PORT || 8080;

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === "my_secret_key") {
    throw new Error("JWT_SECRET deve ser alterado para uma chave aleatória com pelo menos 32 caracteres.");
  }

  await migrate();

  app.listen(PORT, error => {
    if (error) throw error;
    console.log(`Servidor iniciado na porta ${PORT}.`);
  });
}

start().catch(error => {
  console.error("Falha ao iniciar servidor:", error.message);
  process.exitCode = 1;
});
