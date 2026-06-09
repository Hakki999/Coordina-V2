(function (root, factory) {
  const config = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = config;
  }

  root.VALIDATOR_CONFIG = config;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  return {
    tolerancePercent: 0,

    columns: {
      material: {
        key: ["ID", "ID Elemento", "ID do Elemento", "Identificador"],
        point: [
          "Barramento", "Ponto", "Ponto do Erro", "Ponto Elétrico", "Ponto Eletrico",
          "Estrutura", "Poste", "Identificador do Ponto", "ID Ponto", "ID do Ponto",
          "Código do Ponto", "Codigo do Ponto", "Nº Ponto", "N° Ponto", "Nó", "No"
        ],
        pointEnd: ["Barramento 2", "Ponto Final", "Barramento Final", "Ponto 2"],
        code: [
          "Código", "Codigo", "Código Material", "Codigo Material", "Material",
          "Código do Material", "Código do Item", "Codigo do Item"
        ],
        description: [
          "Descrição", "Descricao", "Descrição Material", "Descrição do Material",
          "Texto Breve", "Denominação", "Denominacao"
        ],
        quantity: ["Quantidade", "Qtd", "QDE", "Qtde", "Quantidade Material", "Quantidade do Material"],
        unit: ["Unidade", "UM", "Unid."],
        action: ["Ação", "Acao", "Tipo Ação", "Tipo Acao", "Movimento"],
        type: ["Tipo do Elemento", "Tipo", "Família", "Familia"],
        group: ["Grupo", "Grupo do Elemento", "Nível", "Nivel"],
        phase: ["Fase", "Fases"],
        status: ["Situação", "Situacao", "Status"]
      },
      service: {
        key: ["ID", "ID Elemento", "ID do Elemento", "Identificador"],
        point: [
          "Barramento", "Ponto", "Ponto do Erro", "Ponto Elétrico", "Ponto Eletrico",
          "Estrutura", "Poste", "Identificador do Ponto", "ID Ponto", "ID do Ponto",
          "Código do Ponto", "Codigo do Ponto", "Nº Ponto", "N° Ponto", "Nó", "No"
        ],
        code: [
          "Código Serviço", "Codigo Servico", "Código do Serviço", "Codigo do Servico",
          "Serviço", "Servico", "Código SAP", "Codigo SAP", "UP", "Nº Serviço", "N° Serviço"
        ],
        description: [
          "Descrição Serviço", "Descricao Servico", "Descrição do Serviço",
          "Texto Breve", "Descrição", "Descricao"
        ],
        quantity: [
          "Solicitado", "Quantidade", "Qtd", "QDE", "Qtde",
          "Quantidade Serviço", "Quantidade do Serviço", "Qtd Solicitada"
        ],
        unit: ["Unidade", "UM", "Unid."],
        action: ["Ação", "Acao", "Tipo Ação", "Tipo Acao", "Movimento"],
        caderno: ["Caderno", "Tipo de Equipe", "Turma"],
        group: ["Grupo", "Grupo do Serviço", "Grupo do Servico"],
        status: ["Situação", "Situacao", "Status"],
        element: ["Elemento", "Tipo do Elemento", "Tipo"]
      }
    },

    inactiveStatuses: {
      material: ["RETIRADO", "CANCELADO", "EXCLUIDO", "EXCLUÍDO"],
      service: ["SERVICO RETIRADO", "SERVIÇO RETIRADO", "CANCELADO", "EXCLUIDO", "EXCLUÍDO"]
    },

    rules: {
      catalog: true,
      pointIntegrity: true,
      customLinks: true,
      cable: true,
      dataQuality: true,
      unmappedMaterial: true,
      unmappedService: true,
      unitConsistency: true,
      descriptionConsistency: true
    },

    cable: {
      keywords: [
        "CABO", "CONDUTOR", "MULTIPLEX", "MULTIPLEXADO", "CONCENTRICO",
        "CONCÊNTRICO", "CORDOALHA", "FIO"
      ],
      serviceFamilies: ["CONDUTOR NU", "CONDUTOR ISOLADO", "REDE COMPACTA"],
      linearUnits: ["M", "METRO", "METROS", "M LINEAR", "METRO LINEAR"],
      defaultQuantityMultiplier: 1,
      quantityMultipliersByPhase: {
        ABC: 4.41
      }
    },

    /*
     * Vínculos específicos editáveis.
     * Inclua novos grupos seguindo o mesmo formato. A comparação é feita por ponto.
     */
    associations: [
      {
        id: "POSTES",
        name: "Postes",
        materialCodes: [
          "PDT9/150", "PDT9/300", "PDT9/600", "PDT9/1000", "PDT9/1500", "PDT9/2000", "PDT9/2500",
          "PDT10/150", "PDT10/300", "PDT10/600", "PDT10/1000", "PDT10/1500", "PDT10/2000", "PDT10/2500",
          "PDT11/150", "PDT11/300", "PDT11/600", "PDT11/1000", "PDT11/1500", "PDT11/2000", "PDT11/2500",
          "PDT12/150", "PDT12/300", "PDT12/600", "PDT12/1000", "PDT12/1500", "PDT12/2000", "PDT12/2500",
          "PDT13/150", "PDT13/300", "PDT13/600", "PDT13/1000", "PDT13/1500", "PDT13/2000", "PDT13/2500",
          "PCC11/150", "PCC11/300", "PCC11/600", "PCC11/1000", "PCC11/1500", "PCC11/2000", "PCC11/2500",
          "PCC12/150", "PCC12/300", "PCC12/600", "PCC12/1000", "PCC12/1500", "PCC12/2000", "PCC12/2500"
        ],
        serviceCodes: ["5020000092", "5020000093"],
        compareQuantity: true
      },
      {
        id: "ESTRUTURAS_N1_M1_B1",
        name: "Estruturas N1, M1 e B1",
        materialCodes: ["N1", "M1", "B1"],
        serviceCodes: ["5021000131", "5031200310", "5021000132", "5031200311"],
        compareQuantity: true
      },
      {
        id: "ESTRUTURA_N2",
        name: "Estrutura N2",
        materialCodes: ["N2"],
        serviceCodes: ["5021000133", "5031200312"],
        compareQuantity: true
      },
      {
        id: "ESTRUTURA_N3",
        name: "Estrutura N3",
        materialCodes: ["N3"],
        serviceCodes: ["5021000135", "5031200314"],
        compareQuantity: true
      },
      {
        id: "ESTRUTURA_N4",
        name: "Estrutura N4",
        materialCodes: ["N4"],
        serviceCodes: ["5021000137", "5031200316"],
        compareQuantity: true
      },
      {
        id: "ATERRAMENTO_CERCA",
        name: "Aterramento de cerca",
        materialCodes: ["ATE017"],
        serviceCodes: ["5022200037"],
        compareQuantity: true
      },
      {
        id: "ESTAI_ANCORA",
        name: "Estai âncora",
        materialCodes: ["EST015"],
        serviceCodes: ["5020200034"],
        compareQuantity: true
      },
      {
        id: "CHAVE_FACA",
        name: "Chave faca",
        materialCodes: ["CHA007"],
        serviceCodes: ["5025300176"],
        compareQuantity: true
      },
      {
        id: "COMPONENTES_ESTRUTURA",
        name: "Componentes incluídos no serviço de estrutura",
        materialCodes: ["CRU038", "CRU039", "ISO083", "ISO119", "ISO120", "ISO123"],
        serviceCodes: [
          "5021000131", "5021000133", "5021000135", "5021000137",
          "5031200310", "5031200312", "5031200314", "5031200316"
        ],
        compareQuantity: false,
        requireMaterialForService: false
      },
      {
        id: "BASE_CONCRETO_POSTE",
        name: "Base de concreto vinculada ao poste",
        materialPrefixes: ["PDT", "PCC"],
        serviceCodes: ["5020100056", "5020100057"],
        compareQuantity: false,
        requireServiceForMaterial: false,
        requireMaterialForService: true
      },
      {
        id: "TURMA_LV_POSTE_ESTRUTURA",
        name: "Turma LV de instalação de poste e estrutura",
        materialCodes: ["N1", "N2", "N3", "N4"],
        serviceCodes: ["5031200338"],
        compareQuantity: false,
        requireServiceForMaterial: false,
        requireMaterialForService: true
      }
    ]
  };
});
