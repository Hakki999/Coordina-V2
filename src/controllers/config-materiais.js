const db = require("../models/db");

function idValido(id) {
  if (id === null || id === undefined || id === "" || id === "null") {
    return false;
  }

  const numero = Number(id);
  return Number.isInteger(numero) && numero > 0;
}

async function alterarConfig(req, res) {
  let connection;

  try {
    console.log("Body recebido:", req.body);

    const { itens = [], deletados = [] } = req.body;

    if (!Array.isArray(itens)) {
      return res.status(400).json({
        success: false,
        error: "O campo itens precisa ser um array."
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    let criados = 0;
    let atualizados = 0;
    let excluidos = 0;
    let ignorados = 0;

    /*
      ============================
      DELETAR REGISTROS
      ============================
    */

    const idsParaDeletar = Array.isArray(deletados)
      ? deletados
          .map((item) => {
            if (typeof item === "object" && item !== null) {
              return Number(item.id);
            }

            return Number(item);
          })
          .filter((id) => Number.isInteger(id) && id > 0)
      : [];

    if (idsParaDeletar.length > 0) {
      const placeholders = idsParaDeletar.map(() => "?").join(",");

      const [deleteResult] = await connection.query(
        `
          DELETE FROM config_listas_materiais
          WHERE id IN (${placeholders})
        `,
        idsParaDeletar
      );

      excluidos = deleteResult.affectedRows;
    }

    /*
      ============================
      CRIAR OU ATUALIZAR REGISTROS
      ============================
    */

    for (const item of itens) {
      const id = item.id;

      const up = String(item.up || "")
        .trim()
        .toUpperCase();

      const qtd = String(item.qtd ?? item.quantidade ?? "")
        .trim();

      const material = String(item.material || "")
        .trim();

      if (!up || !qtd || !material) {
        ignorados++;
        continue;
      }

      if (idValido(id)) {
        await connection.query(
          `
            INSERT INTO config_listas_materiais
              (id, up, quantidade, material)
            VALUES
              (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              up = VALUES(up),
              quantidade = VALUES(quantidade),
              material = VALUES(material)
          `,
          [
            Number(id),
            up,
            qtd,
            material
          ]
        );

        atualizados++;
      } else {
        await connection.query(
          `
            INSERT INTO config_listas_materiais
              (up, quantidade, material)
            VALUES
              (?, ?, ?)
          `,
          [
            up,
            qtd,
            material
          ]
        );

        criados++;
      }
    }

    await connection.commit();

    return res.json({
      success: true,
      message: "Configurações salvas com sucesso.",
      resumo: {
        criados,
        atualizados,
        excluidos,
        ignorados
      }
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Erro ao salvar configurações:", error);

    return res.status(500).json({
      success: false,
      error: "Erro ao salvar configurações."
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = alterarConfig;