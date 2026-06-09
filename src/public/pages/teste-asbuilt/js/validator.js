(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.AsBuiltValidator = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SEVERITY_ORDER = { critical: 0, error: 1, warning: 2, info: 3 };

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function normalizeCode(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Number.isInteger(value) ? String(value) : String(value);
    }

    return normalizeText(value).replace(/\.0+$/, "");
  }

  function parseNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (value === null || value === undefined || String(value).trim() === "") return null;

    let text = String(value).replace(/\s/g, "").replace(/R\$/gi, "");

    if (text.includes(",") && text.includes(".")) {
      text = text.lastIndexOf(",") > text.lastIndexOf(".")
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
    } else if (text.includes(",")) {
      text = text.replace(",", ".");
    }

    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeUnit(value) {
    const unit = normalizeText(value);
    const aliases = {
      UN: "UNIDADE",
      UND: "UNIDADE",
      UNID: "UNIDADE",
      CJ: "CONJUNTO",
      CONJ: "CONJUNTO",
      M: "METRO",
      MT: "METRO",
      METROS: "METRO"
    };

    return aliases[unit] || unit;
  }

  function round(value, places = 4) {
    return Number(Number(value || 0).toFixed(places));
  }

  function percentDifference(expected, found) {
    if (!expected && !found) return 0;
    if (!expected) return 100;
    return Math.abs(found - expected) / Math.abs(expected) * 100;
  }

  function isOutsideTolerance(expected, found, tolerancePercent) {
    return percentDifference(expected, found) > Number(tolerancePercent || 0) + 0.000001;
  }

  function findColumn(rows, aliases) {
    const headers = new Set();

    (rows || []).slice(0, 30).forEach(row => {
      Object.keys(row || {}).forEach(header => headers.add(header));
    });

    const normalizedHeaders = new Map(
      Array.from(headers).map(header => [normalizeText(header), header])
    );

    for (const alias of aliases || []) {
      const exact = normalizedHeaders.get(normalizeText(alias));
      if (exact) return exact;
    }

    return null;
  }

  function resolveColumns(rows, aliasesByField) {
    return Object.fromEntries(
      Object.entries(aliasesByField || {}).map(([field, aliases]) => [
        field,
        findColumn(rows, aliases)
      ])
    );
  }

  function inferAction(text) {
    const normalized = normalizeText(text);
    if (/\b(RET|RETIRAR|RETIRADA|REMOVER|REMOCAO|DESINST)\b/.test(normalized)) return "RET";
    if (/\b(INST|INSTALAR|INSTALACAO|MONTAR|LANCAR)\b/.test(normalized)) return "INST";
    return "";
  }

  function buildLocation(identity, pointStart, pointEnd) {
    const parts = [];
    if (identity) parts.push(`ID ${identity}`);
    if (pointStart && pointEnd) parts.push(`${pointStart} -> ${pointEnd}`);
    else if (pointStart) parts.push(pointStart);
    return parts.join(" | ");
  }

  function canonicalizeRows(rows, type, columns, config, knownLocations = new Map()) {
    const hasLocationColumn = Boolean(columns.point || columns.key);
    const inactiveStatuses = new Set(
      (config.inactiveStatuses?.[type] || []).map(normalizeText)
    );

    return (rows || []).map((raw, index) => {
      const description = columns.description ? raw[columns.description] : "";
      const action = inferAction(
        [columns.action ? raw[columns.action] : "", description].filter(Boolean).join(" ")
      );
      const identity = normalizeCode(columns.key ? raw[columns.key] : "");
      const pointStart = normalizeText(columns.point ? raw[columns.point] : "");
      const pointEnd = normalizeText(columns.pointEnd ? raw[columns.pointEnd] : "");
      const ownLocation = pointStart ? buildLocation(identity, pointStart, pointEnd) : "";
      const point = ownLocation
        || knownLocations.get(identity)
        || buildLocation(identity, "", "")
        || (hasLocationColumn ? "" : "__GLOBAL__");
      const status = normalizeText(columns.status ? raw[columns.status] : "");

      return {
        source: type,
        line: index + 2,
        key: identity ? `ID:${identity}` : pointStart ? `POINT:${pointStart}|${pointEnd}` : "__GLOBAL__",
        identity,
        point,
        pointStart,
        pointEnd,
        code: normalizeCode(columns.code ? raw[columns.code] : ""),
        description: String(description ?? "").trim(),
        quantity: parseNumber(columns.quantity ? raw[columns.quantity] : null),
        unit: normalizeUnit(columns.unit ? raw[columns.unit] : ""),
        action,
        type: normalizeText(columns.type ? raw[columns.type] : ""),
        group: normalizeText(columns.group ? raw[columns.group] : ""),
        caderno: normalizeText(columns.caderno ? raw[columns.caderno] : ""),
        phase: normalizeText(columns.phase ? raw[columns.phase] : ""),
        element: normalizeText(columns.element ? raw[columns.element] : ""),
        status,
        active: !inactiveStatuses.has(status),
        raw
      };
    }).filter(row => {
      return row.code || row.description || row.quantity !== null || row.identity || (row.point && row.point !== "__GLOBAL__");
    });
  }

  function buildLocationIndex(materials) {
    const locations = new Map();

    materials.forEach(row => {
      if (row.identity && row.point && row.point !== "__GLOBAL__" && !locations.has(row.identity)) {
        locations.set(row.identity, row.point);
      }
    });

    return locations;
  }

  function issuePoint(materialRows, serviceRows, fallback = "GERAL") {
    const row = [...(materialRows || []), ...(serviceRows || [])]
      .find(item => item.point && item.point !== "__GLOBAL__");
    return row?.point || fallback;
  }

  function buildCatalogIndex(catalog) {
    const index = new Map();

    (catalog || []).forEach((item, itemIndex) => {
      const normalized = {
        ...item,
        codigoSap: normalizeCode(item.codigoSap),
        up: normalizeCode(item.up),
        descricao: String(item.descricao ?? "").trim(),
        descricaoCompleta: String(item.descricaoCompleta ?? "").trim(),
        unidade: normalizeUnit(item.unidade),
        familia: normalizeText(item.familia),
        caderno: normalizeText(item.caderno),
        catalogIndex: itemIndex
      };

      [normalized.codigoSap, normalized.up].filter(Boolean).forEach(code => {
        if (!index.has(code)) index.set(code, []);
        index.get(code).push(normalized);
      });
    });

    return index;
  }

  function groupBy(rows, keyFn) {
    const map = new Map();

    rows.forEach(row => {
      const key = keyFn(row);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });

    return map;
  }

  function sumQuantity(rows) {
    return round(rows.reduce((total, row) => total + (row.quantity || 0), 0));
  }

  function locationDetails(materialRows, serviceRows) {
    const parts = [];
    const materialLines = (materialRows || []).map(row => row.line).filter(Boolean);
    const serviceLines = (serviceRows || []).map(row => row.line).filter(Boolean);

    if (materialLines.length) parts.push(`Linhas de materiais: ${materialLines.join(", ")}`);
    if (serviceLines.length) parts.push(`Linhas de serviços: ${serviceLines.join(", ")}`);

    return parts.join(". ");
  }

  function includesKeyword(text, keywords) {
    const normalized = normalizeText(text);
    return (keywords || []).some(keyword => normalized.includes(normalizeText(keyword)));
  }

  function isCableMaterial(row, config) {
    return includesKeyword(`${row.type} ${row.description}`, config.cable?.keywords);
  }

  function isCableService(row, catalogItems, config) {
    const catalogText = (catalogItems || []).map(item =>
      `${item.familia} ${item.descricao} ${item.descricaoCompleta} ${item.unidade}`
    ).join(" ");
    const text = `${row.description} ${catalogText}`;
    const isCable = includesKeyword(text, config.cable?.keywords)
      || (catalogItems || []).some(item => (config.cable?.serviceFamilies || []).includes(item.familia));
    const isLinear = (catalogItems || []).some(item =>
      (config.cable?.linearUnits || []).includes(item.unidade)
      || normalizeText(`${item.descricao} ${item.descricaoCompleta}`).includes("METRO LINEAR")
    );

    if ((catalogItems || []).length) return isCable && isLinear;

    return isCable && (config.cable?.linearUnits || []).includes(row.unit);
  }

  function extractBitolas(text) {
    const normalized = normalizeText(text).replace(/,/g, ".");
    const values = [];
    const patterns = [
      /(\d+(?:\.\d+)?)\s*MM(?:2|²)?/g,
      /\d+\s*X\s*(\d+(?:\.\d+)?)(?=\s*(?:MM(?:2|²)?|\(|\+|-|$))/g,
      /\((\d+(?:\.\d+)?)\)/g
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(normalized)) !== null) {
        const value = Number(match[1]);
        if (Number.isFinite(value) && value > 0) values.push(value);
      }
    });

    return Array.from(new Set(values)).sort((a, b) => a - b);
  }

  function catalogBitolaRanges(items) {
    return (items || []).map(item => {
      const values = extractBitolas(`${item.descricao} ${item.descricaoCompleta}`);
      if (!values.length) return null;
      return { min: Math.min(...values), max: Math.max(...values), values };
    }).filter(Boolean);
  }

  function extractAwg(text) {
    const normalized = normalizeText(text);
    const values = [];
    const pattern = /\b(\d+\/0|\d+)\s*AWG\b/g;
    let match;

    while ((match = pattern.exec(normalized)) !== null) {
      values.push(match[1]);
    }

    return Array.from(new Set(values));
  }

  function cableQuantityFactor(row, config) {
    const byPhase = config.cable?.quantityMultipliersByPhase || {};
    return Number(byPhase[row.phase] ?? config.cable?.defaultQuantityMultiplier ?? 1);
  }

  function adjustedCableQuantity(rows, config) {
    return round(rows.reduce((total, row) => {
      return total + (row.quantity || 0) * cableQuantityFactor(row, config);
    }, 0));
  }

  function issueFactory() {
    let id = 0;
    return function addIssue(list, data) {
      list.push({
        id: ++id,
        severity: data.severity || "warning",
        rule: data.rule || "REGRA_NAO_INFORMADA",
        category: data.category || "Geral",
        point: data.point || "GERAL",
        source: data.source || "ambos",
        line: data.line || null,
        code: data.code || "",
        message: data.message || "",
        expected: data.expected ?? "",
        found: data.found ?? "",
        details: data.details || ""
      });
    };
  }

  function validateSchema(rows, type, columns, issues, addIssue) {
    if (!rows.length) {
      addIssue(issues, {
        severity: "critical",
        rule: "BASE_VAZIA",
        category: "Estrutura",
        source: type,
        message: `A base de ${type === "material" ? "materiais" : "serviços"} está vazia.`
      });
      return;
    }

    ["code", "quantity"].forEach(field => {
      if (!columns[field]) {
        addIssue(issues, {
          severity: "critical",
          rule: "COLUNA_OBRIGATORIA_AUSENTE",
          category: "Estrutura",
          source: type,
          message: `Não foi encontrada a coluna obrigatória de ${field === "code" ? "código" : "quantidade"} na base de ${type === "material" ? "materiais" : "serviços"}.`
        });
      }
    });

    if (!columns.point && !columns.key) {
      addIssue(issues, {
        severity: "warning",
        rule: "COLUNA_PONTO_AUSENTE",
        category: "Ponto",
        source: type,
        message: `Nenhuma coluna de ponto ou ID foi reconhecida na base de ${type === "material" ? "materiais" : "serviços"}. A comparação será global.`,
        details: "Adicione o nome da coluna em js/config.js para obter a localização exata do erro."
      });
    }
  }

  function validateDataQuality(rows, type, issues, addIssue, config) {
    const seen = new Map();
    const descriptionsByCode = new Map();

    rows.forEach(row => {
      if (!row.key || row.key === "__GLOBAL__") {
        addIssue(issues, {
          severity: "error",
          rule: "PONTO_NAO_INFORMADO",
          category: "Ponto",
          source: type,
          line: row.line,
          code: row.code,
          message: "A linha não possui ponto/barramento nem ID de elemento informado."
        });
      }

      if (!row.code) {
        addIssue(issues, {
          severity: "error",
          rule: "CODIGO_NAO_INFORMADO",
          category: "Qualidade dos dados",
          source: type,
          point: row.point,
          line: row.line,
          message: "A linha não possui código informado."
        });
      }

      if (row.quantity === null) {
        addIssue(issues, {
          severity: "error",
          rule: "QUANTIDADE_INVALIDA",
          category: "Quantidade",
          source: type,
          point: row.point,
          line: row.line,
          code: row.code,
          message: "A quantidade está vazia ou não é numérica."
        });
      } else if (row.quantity <= 0 && row.active) {
        addIssue(issues, {
          severity: "error",
          rule: "QUANTIDADE_NAO_POSITIVA",
          category: "Quantidade",
          source: type,
          point: row.point,
          line: row.line,
          code: row.code,
          found: row.quantity,
          message: "A quantidade deve ser maior que zero."
        });
      }

      const duplicateKey = [row.key, row.code, row.quantity, row.action, row.status, row.group].join("|");
      if (seen.has(duplicateKey)) {
        addIssue(issues, {
          severity: "warning",
          rule: "LINHA_DUPLICADA",
          category: "Duplicidade",
          source: type,
          point: row.point,
          line: row.line,
          code: row.code,
          message: `Possível linha duplicada. A mesma combinação já apareceu na linha ${seen.get(duplicateKey)}.`
        });
      } else {
        seen.set(duplicateKey, row.line);
      }

      if (row.code && row.description) {
        if (!descriptionsByCode.has(row.code)) descriptionsByCode.set(row.code, new Set());
        descriptionsByCode.get(row.code).add(normalizeText(row.description));
      }
    });

    if (config.rules.descriptionConsistency) {
      descriptionsByCode.forEach((descriptions, code) => {
        if (descriptions.size > 1) {
          addIssue(issues, {
            severity: "warning",
            rule: "DESCRICOES_DIVERGENTES_PARA_CODIGO",
            category: "Qualidade dos dados",
            source: type,
            code,
            message: `O código ${code} aparece com ${descriptions.size} descrições diferentes na mesma base.`
          });
        }
      });
    }
  }

  function validateCatalog(services, catalogIndex, issues, addIssue, config) {
    services.forEach(service => {
      const catalogItems = catalogIndex.get(service.code) || [];

      if (!catalogItems.length) {
        addIssue(issues, {
          severity: "error",
          rule: "SERVICO_FORA_DO_CADERNO_EQTL",
          category: "Caderno EQTL",
          source: "service",
          point: service.point,
          line: service.line,
          code: service.code,
          found: service.description,
          message: "O serviço não foi encontrado no caderno EQTL carregado."
        });
        return;
      }

      if (service.caderno) {
        const cadernosValidos = Array.from(new Set(
          catalogItems.map(item => item.caderno).filter(caderno => /^[A-Z]{2,10}$/.test(caderno))
        ));

        if (cadernosValidos.length && !cadernosValidos.includes(service.caderno)) {
          addIssue(issues, {
            severity: "warning",
            rule: "CADERNO_DIVERGENTE",
            category: "Caderno EQTL",
            source: "service",
            point: service.point,
            line: service.line,
            code: service.code,
            expected: cadernosValidos.join(", "),
            found: service.caderno,
            message: "O caderno/turma informado no As Built difere do catálogo EQTL."
          });
        }
      }

      if (config.rules.unitConsistency && service.unit) {
        const units = Array.from(new Set(catalogItems.map(item => item.unidade).filter(Boolean)));
        if (units.length && !units.includes(service.unit)) {
          addIssue(issues, {
            severity: "warning",
            rule: "UNIDADE_DIVERGENTE_DO_CATALOGO",
            category: "Unidade",
            source: "service",
            point: service.point,
            line: service.line,
            code: service.code,
            expected: units.join(", "),
            found: service.unit,
            message: "A unidade do serviço difere da unidade cadastrada no caderno EQTL."
          });
        }
      }

      const nonLinearUnits = catalogItems.map(item => item.unidade).filter(unit =>
        unit === "UNIDADE" || unit === "CONJUNTO"
      );

      if (nonLinearUnits.length && service.quantity !== null && !Number.isInteger(service.quantity)) {
        addIssue(issues, {
          severity: "warning",
          rule: "QUANTIDADE_FRACIONADA_EM_ITEM_UNITARIO",
          category: "Quantidade",
          source: "service",
          point: service.point,
          line: service.line,
          code: service.code,
          expected: "Número inteiro",
          found: service.quantity,
          message: "O serviço é medido por unidade/conjunto, mas possui quantidade fracionada."
        });
      }
    });
  }

  function validatePoints(materials, services, issues, addIssue) {
    const materialsByPoint = groupBy(materials.filter(row => row.key), row => row.key);
    const servicesByPoint = groupBy(services.filter(row => row.key), row => row.key);
    const points = new Set([...materialsByPoint.keys(), ...servicesByPoint.keys()]);

    points.forEach(key => {
      const pointMaterials = materialsByPoint.get(key) || [];
      const pointServices = servicesByPoint.get(key) || [];
      const point = issuePoint(pointMaterials, pointServices, key);

      if (pointMaterials.length && !pointServices.length) {
        addIssue(issues, {
          severity: "error",
          rule: "PONTO_SEM_SERVICO",
          category: "Ponto",
          source: "ambos",
          point,
          expected: "Ao menos um serviço",
          found: `${pointMaterials.length} linha(s) de material`,
          message: "O ponto possui material, mas não possui nenhum serviço vinculado.",
          details: locationDetails(pointMaterials, [])
        });
      }

      if (pointServices.length && !pointMaterials.length) {
        addIssue(issues, {
          severity: "error",
          rule: "PONTO_SEM_MATERIAL",
          category: "Ponto",
          source: "ambos",
          point,
          expected: "Ao menos um material",
          found: `${pointServices.length} linha(s) de serviço`,
          message: "O ponto possui serviço, mas não possui nenhum material vinculado.",
          details: locationDetails([], pointServices)
        });
      }
    });
  }

  function validateAssociations(materials, services, issues, addIssue, config) {
    const tolerance = Number(config.tolerancePercent || 0);
    const points = new Set([...materials.map(row => row.key), ...services.map(row => row.key)]);
    const mappedMaterialCodes = new Set();
    const mappedServiceCodes = new Set();

    (config.associations || []).forEach(association => {
      const materialCodes = new Set((association.materialCodes || []).map(normalizeCode));
      const materialPrefixes = (association.materialPrefixes || []).map(normalizeCode);
      const serviceCodes = new Set((association.serviceCodes || []).map(normalizeCode));
      const matchesMaterial = row =>
        materialCodes.has(row.code) || materialPrefixes.some(prefix => row.code.startsWith(prefix));
      materialCodes.forEach(code => mappedMaterialCodes.add(code));
      materials.filter(matchesMaterial).forEach(row => mappedMaterialCodes.add(row.code));
      serviceCodes.forEach(code => mappedServiceCodes.add(code));

      points.forEach(key => {
        const pointMaterials = materials.filter(row => row.key === key && matchesMaterial(row));
        const pointServices = services.filter(row => row.key === key && serviceCodes.has(row.code));
        const point = issuePoint(pointMaterials, pointServices, key);
        const materialTotal = sumQuantity(pointMaterials);
        const serviceTotal = sumQuantity(pointServices);

        if (association.requireServiceForMaterial !== false && pointMaterials.length && !pointServices.length) {
          addIssue(issues, {
            severity: "error",
            rule: "MATERIAL_SEM_SERVICO_VINCULADO",
            category: "Vínculo material x serviço",
            source: "ambos",
            point,
            code: pointMaterials.map(row => row.code).join(", "),
            expected: Array.from(serviceCodes).join(", "),
            found: "Nenhum serviço",
            message: `${association.name}: existe material no ponto, mas nenhum dos serviços configurados foi encontrado.`,
            details: locationDetails(pointMaterials, [])
          });
        }

        if (association.requireMaterialForService !== false && pointServices.length && !pointMaterials.length) {
          addIssue(issues, {
            severity: "error",
            rule: "SERVICO_SEM_MATERIAL_VINCULADO",
            category: "Vínculo material x serviço",
            source: "ambos",
            point,
            code: pointServices.map(row => row.code).join(", "),
            expected: [
              ...Array.from(materialCodes),
              ...materialPrefixes.map(prefix => `${prefix}*`)
            ].join(", "),
            found: "Nenhum material",
            message: `${association.name}: existe serviço no ponto, mas nenhum dos materiais configurados foi encontrado.`,
            details: locationDetails([], pointServices)
          });
        }

        if (
          association.compareQuantity !== false
          && pointMaterials.length
          && pointServices.length
          && isOutsideTolerance(materialTotal, serviceTotal, tolerance)
        ) {
          addIssue(issues, {
            severity: "error",
            rule: "QUANTIDADE_VINCULO_FORA_DA_TOLERANCIA",
            category: "Quantidade",
            source: "ambos",
            point,
            expected: materialTotal,
            found: serviceTotal,
            details: `Diferença de ${round(percentDifference(materialTotal, serviceTotal), 2)}%. Tolerância: ${tolerance}%. ${locationDetails(pointMaterials, pointServices)}`,
            message: `${association.name}: a quantidade de materiais e serviços vinculados está fora da tolerância.`
          });
        }
      });
    });

    return { mappedMaterialCodes, mappedServiceCodes };
  }

  function validateCables(materials, services, catalogIndex, issues, addIssue, config) {
    const tolerance = Number(config.tolerancePercent || 0);
    const cableMaterials = materials.filter(row => isCableMaterial(row, config));
    const cableServices = services.filter(row =>
      isCableService(row, catalogIndex.get(row.code) || [], config)
    );
    const points = new Set([...cableMaterials.map(row => row.key), ...cableServices.map(row => row.key)]);

    points.forEach(key => {
      const allPointMaterials = cableMaterials.filter(row => row.key === key);
      const allPointServices = cableServices.filter(row => row.key === key);
      const point = issuePoint(allPointMaterials, allPointServices, key);
      const hasUnknownAction = [...allPointMaterials, ...allPointServices].some(row => !row.action);
      const materialActions = new Set(allPointMaterials.map(row => row.action).filter(Boolean));
      const serviceActions = new Set(allPointServices.map(row => row.action).filter(Boolean));
      const comparableActions = Array.from(materialActions).filter(action => serviceActions.has(action));

      if (
        !hasUnknownAction
        && materialActions.size
        && serviceActions.size
        && !comparableActions.length
      ) {
        addIssue(issues, {
          severity: "error",
          rule: "ACAO_CABO_DIVERGENTE",
          category: "Cabos",
          source: "ambos",
          point,
          expected: Array.from(materialActions).join(", "),
          found: Array.from(serviceActions).join(", "),
          message: "A ação do cabo/condutor é incompatível com a ação do serviço no mesmo ponto.",
          details: locationDetails(allPointMaterials, allPointServices)
        });
      }

      const actionGroups = !hasUnknownAction && comparableActions.length
        ? comparableActions
        : ["__ALL__"];

      actionGroups.forEach(action => {
        const matchesAction = row => action === "__ALL__" || row.action === action;
        const pointMaterials = cableMaterials.filter(row => row.key === key && matchesAction(row));
        const pointServices = cableServices.filter(row => row.key === key && matchesAction(row));

        if (!pointMaterials.length && !pointServices.length) return;

        const actionLabel = action === "__ALL__" ? "todas as ações do ponto" : action;

        if (pointMaterials.length && !pointServices.length) {
          addIssue(issues, {
            severity: "error",
            rule: "CABO_SEM_SERVICO",
            category: "Cabos",
            source: "ambos",
            point,
            code: pointMaterials.map(row => row.code).join(", "),
            message: `Há cabo/condutor no ponto (${actionLabel}), mas nenhum serviço linear correspondente foi identificado.`,
            details: locationDetails(pointMaterials, [])
          });
          return;
        }

        if (pointServices.length && !pointMaterials.length) {
          addIssue(issues, {
            severity: "error",
            rule: "SERVICO_DE_CABO_SEM_MATERIAL",
            category: "Cabos",
            source: "ambos",
            point,
            code: pointServices.map(row => row.code).join(", "),
            message: `Há serviço de cabo/condutor no ponto (${actionLabel}), mas nenhum material correspondente foi identificado.`,
            details: locationDetails([], pointServices)
          });
          return;
        }

        const rawMaterialTotal = sumQuantity(pointMaterials);
        const materialTotal = adjustedCableQuantity(pointMaterials, config);
        const serviceTotal = sumQuantity(pointServices);

        if (isOutsideTolerance(materialTotal, serviceTotal, tolerance)) {
          addIssue(issues, {
            severity: "error",
            rule: "METRAGEM_CABO_FORA_DA_TOLERANCIA",
            category: "Cabos",
            source: "ambos",
            point,
            expected: materialTotal,
            found: serviceTotal,
            details: `Comprimento do material: ${rawMaterialTotal}. Quantidade esperada após fator por fase: ${materialTotal}. Diferença de ${round(percentDifference(materialTotal, serviceTotal), 2)}%. Tolerância: ${tolerance}%. ${locationDetails(pointMaterials, pointServices)}`,
            message: `A metragem total de cabo e a quantidade total dos serviços (${actionLabel}) estão fora da tolerância.`
          });
        }

        const materialBitolas = Array.from(new Set(
          pointMaterials.flatMap(row => extractBitolas(row.description))
        ));
        const serviceRanges = catalogBitolaRanges(
          pointServices.flatMap(row => catalogIndex.get(row.code) || [])
        );
        const materialAwg = Array.from(new Set(
          pointMaterials.flatMap(row => extractAwg(row.description))
        ));
        const serviceAwg = Array.from(new Set(
          pointServices.flatMap(row => {
            const catalogItems = catalogIndex.get(row.code) || [];
            return extractAwg(`${row.description} ${catalogItems.map(item => `${item.descricao} ${item.descricaoCompleta}`).join(" ")}`);
          })
        ));

        if (materialBitolas.length && serviceRanges.length) {
          const incompatible = materialBitolas.filter(bitola =>
            !serviceRanges.some(range => bitola >= range.min && bitola <= range.max)
          );

          if (incompatible.length) {
            addIssue(issues, {
              severity: "error",
              rule: "BITOLA_CABO_INCOMPATIVEL_COM_SERVICO",
              category: "Cabos",
              source: "ambos",
              point,
              expected: serviceRanges.map(range => `${range.min}-${range.max} mm²`).join(", "),
              found: incompatible.map(value => `${value} mm²`).join(", "),
              message: "A bitola identificada no material não está dentro da faixa prevista pelo serviço EQTL.",
              details: locationDetails(pointMaterials, pointServices)
            });
          }
        }

        if (materialAwg.length && serviceAwg.length && !materialAwg.some(value => serviceAwg.includes(value))) {
          addIssue(issues, {
            severity: "error",
            rule: "BITOLA_AWG_INCOMPATIVEL_COM_SERVICO",
            category: "Cabos",
            source: "ambos",
            point,
            expected: serviceAwg.map(value => `${value} AWG`).join(", "),
            found: materialAwg.map(value => `${value} AWG`).join(", "),
            message: "A bitola AWG identificada no material não corresponde à bitola descrita no serviço EQTL.",
            details: locationDetails(pointMaterials, pointServices)
          });
        }
      });
    });

    return {
      cableMaterialCodes: new Set(cableMaterials.map(row => row.code)),
      cableServiceCodes: new Set(cableServices.map(row => row.code))
    };
  }

  function validateUnmapped(materials, services, mapped, cableMapped, issues, addIssue, config) {
    if (config.rules.unmappedMaterial) {
      const byPointAndCode = groupBy(
        materials.filter(row =>
          row.code
          && !mapped.mappedMaterialCodes.has(row.code)
          && !cableMapped.cableMaterialCodes.has(row.code)
        ),
        row => `${row.key}|${row.code}`
      );

      byPointAndCode.forEach(rows => {
        const row = rows[0];
        addIssue(issues, {
          severity: "warning",
          rule: "MATERIAL_SEM_REGRA_DE_VINCULO",
          category: "Cobertura das regras",
          source: "material",
          point: row.point,
          line: row.line,
          code: row.code,
          message: "O material não possui uma regra específica de vínculo configurada.",
          details: "Inclua o vínculo em js/config.js quando este material exigir um serviço obrigatório."
        });
      });
    }

    if (config.rules.unmappedService) {
      const byPointAndCode = groupBy(
        services.filter(row =>
          row.code
          && !mapped.mappedServiceCodes.has(row.code)
          && !cableMapped.cableServiceCodes.has(row.code)
        ),
        row => `${row.key}|${row.code}`
      );

      byPointAndCode.forEach(rows => {
        const row = rows[0];
        addIssue(issues, {
          severity: "info",
          rule: "SERVICO_SEM_REGRA_DE_VINCULO",
          category: "Cobertura das regras",
          source: "service",
          point: row.point,
          line: row.line,
          code: row.code,
          message: "O serviço não possui uma regra específica de vínculo com material.",
          details: "Inclua o vínculo em js/config.js quando este serviço exigir um material obrigatório."
        });
      });
    }
  }

  function summarize(issues, materials, services, catalog, allServices = services) {
    const points = new Set([
      ...materials.map(row => row.key).filter(Boolean),
      ...services.map(row => row.key).filter(Boolean)
    ]);

    return {
      totalIssues: issues.length,
      critical: issues.filter(issue => issue.severity === "critical").length,
      errors: issues.filter(issue => issue.severity === "error").length,
      warnings: issues.filter(issue => issue.severity === "warning").length,
      info: issues.filter(issue => issue.severity === "info").length,
      points: points.size,
      pointsWithIssues: new Set(issues.map(issue => issue.point).filter(point => point && point !== "GERAL")).size,
      materials: materials.length,
      services: services.length,
      excludedServices: allServices.filter(row => !row.active).length,
      catalogItems: (catalog || []).length
    };
  }

  function analyze(materialRows, serviceRows, userConfig, catalog) {
    const config = userConfig || {};
    const issues = [];
    const addIssue = issueFactory();
    const materialColumns = resolveColumns(materialRows, config.columns?.material || {});
    const serviceColumns = resolveColumns(serviceRows, config.columns?.service || {});

    validateSchema(materialRows || [], "material", materialColumns, issues, addIssue);
    validateSchema(serviceRows || [], "service", serviceColumns, issues, addIssue);

    const allMaterials = canonicalizeRows(materialRows, "material", materialColumns, config);
    const materialLocations = buildLocationIndex(allMaterials);
    const allServices = canonicalizeRows(serviceRows, "service", serviceColumns, config, materialLocations);
    const materials = allMaterials.filter(row => row.active);
    const services = allServices.filter(row => row.active);
    const catalogIndex = buildCatalogIndex(catalog);

    if (config.rules?.dataQuality !== false) {
      validateDataQuality(allMaterials, "material", issues, addIssue, config);
      validateDataQuality(allServices, "service", issues, addIssue, config);
    }

    if (config.rules?.catalog !== false) {
      validateCatalog(services, catalogIndex, issues, addIssue, config);
    }

    if (config.rules?.pointIntegrity !== false) {
      validatePoints(materials, services, issues, addIssue);
    }

    let mapped = { mappedMaterialCodes: new Set(), mappedServiceCodes: new Set() };
    if (config.rules?.customLinks !== false) {
      mapped = validateAssociations(materials, services, issues, addIssue, config);
    }

    let cableMapped = { cableMaterialCodes: new Set(), cableServiceCodes: new Set() };
    if (config.rules?.cable !== false) {
      cableMapped = validateCables(materials, services, catalogIndex, issues, addIssue, config);
    }

    if (config.rules?.customLinks !== false) {
      validateUnmapped(materials, services, mapped, cableMapped, issues, addIssue, config);
    }

    issues.sort((a, b) => {
      return (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
        || String(a.point).localeCompare(String(b.point))
        || (a.line || 0) - (b.line || 0);
    });

    return {
      issues,
      summary: summarize(issues, materials, services, catalog, allServices),
      columns: { material: materialColumns, service: serviceColumns },
      canonical: { materials, services, allMaterials, allServices }
    };
  }

  return {
    analyze,
    normalizeText,
    normalizeCode,
    parseNumber,
    extractBitolas,
    percentDifference,
    isOutsideTolerance
  };
});
