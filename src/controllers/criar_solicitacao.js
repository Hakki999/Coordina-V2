const db = require("../models/db");


async function criarSolicitacao(req, res){
    const materaiais = req.body.materiaisCalculados;
    const formulario = req.body.formulario;
    const userId = req.usuario.id_usuario;

    const sql = `INSERT INTO materiais_solicitados (usuario_id, projeto, cidade, equipe, tensao_rede, data_exe, tipo_servico, observacao, criado_em, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const result = await db.execute(sql, [userId, formulario.projeto, formulario.cidade, formulario.equipe, formulario.tensao_rede, formulario.data_exe, formulario.tipo_servico, formulario.observacao, new Date(), 'Pendente']);

    const insertId = result[0].insertId;
    try {
        
        for (const material of materaiais) {
            const sqlMaterial = `INSERT INTO materiais_solicitados_items (solicitacao_id, descricao_material, quantidade_sol) VALUES (?, ?, ?)`;
            await db.execute(sqlMaterial, [insertId, material.descricao, material.quantidade]);
            
        }
        
    } catch (error) {
        console.error('Erro ao adicionar solicitação:', error);
        throw error;
    }
}

module.exports = criarSolicitacao;