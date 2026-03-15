const crypto = require("crypto");
const Papa = require("papaparse");

const LETTER_GRADES = new Set(["A", "B", "C", "D", "E", "F"]);

const normalizeLabel = (value) => {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

const parseFrenchNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseAssessmentDate = (value) => {
  if (!value) {
    return null;
  }

  const [datePart] = String(value).trim().split(" ");
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(datePart);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};

const parseGrade = (rawValue) => {
  const gradeRaw = String(rawValue || "").trim();
  const upper = gradeRaw.toUpperCase();

  if (!gradeRaw) {
    return {
      gradeRaw,
      gradeKind: "unknown",
      numericGrade: null,
    };
  }

  if (upper === "V") {
    return {
      gradeRaw,
      gradeKind: "validated",
      numericGrade: null,
    };
  }

  if (upper === "NV") {
    return {
      gradeRaw,
      gradeKind: "not_validated",
      numericGrade: null,
    };
  }

  if (LETTER_GRADES.has(upper)) {
    return {
      gradeRaw,
      gradeKind: "letter",
      numericGrade: null,
    };
  }

  const numericGrade = parseFrenchNumber(gradeRaw);
  if (numericGrade !== null) {
    return {
      gradeRaw,
      gradeKind: "numeric",
      numericGrade,
    };
  }

  return {
    gradeRaw,
    gradeKind: "unknown",
    numericGrade: null,
  };
};

const extractAssessmentName = (rawValue) => {
  const rawAssessmentName = String(rawValue || "").trim();
  if (!rawAssessmentName) {
    return "";
  }

  const lastSeparatorIndex = rawAssessmentName.lastIndexOf(" - ");
  if (lastSeparatorIndex === -1) {
    return rawAssessmentName;
  }

  const trimmed = rawAssessmentName.slice(lastSeparatorIndex + 3).trim();
  return trimmed || rawAssessmentName;
};

const buildFingerprint = (entry) => {
  const base = [
    entry.moduleName,
    entry.rawAssessmentName || entry.assessmentName,
    entry.assessmentType,
    entry.assessmentDetail,
    entry.coefficient,
    entry.startAt,
    entry.endAt,
    entry.gradeRaw,
  ].join("|");

  return crypto.createHash("sha256").update(base).digest("hex");
};

const buildModuleSummary = (moduleName, entries, moduleCoefficient = 1) => {
  let totalPoints = 0;
  let totalCoefficient = 0;
  let validatedCount = 0;
  let notValidatedCount = 0;
  let letterGradeCount = 0;

  entries.forEach((entry) => {
    if (entry.gradeKind === "numeric" && entry.coefficient) {
      totalPoints += entry.numericGrade * entry.coefficient;
      totalCoefficient += entry.coefficient;
      return;
    }

    if (entry.gradeKind === "validated") {
      validatedCount += 1;
      return;
    }

    if (entry.gradeKind === "not_validated") {
      notValidatedCount += 1;
      return;
    }

    if (entry.gradeKind === "letter") {
      letterGradeCount += 1;
    }
  });

  const average = totalCoefficient > 0 ? totalPoints / totalCoefficient : null;
  const resultKind =
    average !== null
      ? "numeric"
      : notValidatedCount > 0
        ? "not_validated"
        : validatedCount > 0 || letterGradeCount > 0
          ? "validated"
          : "empty";

  return {
    moduleName,
    normalizedModuleName: normalizeLabel(moduleName),
    coefficient: moduleCoefficient,
    average,
    resultKind,
    totals: {
      totalPoints,
      totalCoefficient,
    },
    counts: {
      entries: entries.length,
      numericEntries: entries.filter((entry) => entry.gradeKind === "numeric")
        .length,
      validated: validatedCount,
      notValidated: notValidatedCount,
      letter: letterGradeCount,
    },
    entries,
  };
};

const buildRuleMatcher = (rule) => {
  const normalizedModuleName = normalizeLabel(rule.module_name);
  const normalizedAssessmentName = normalizeLabel(rule.assessment_name);
  const normalizedAssessmentType = normalizeLabel(rule.assessment_type);
  const normalizedGradeValue = String(rule.grade_value || "").trim();

  return (entry) => {
    if (!rule.active) {
      return false;
    }

    if (
      rule.entry_fingerprint &&
      entry.fingerprint === rule.entry_fingerprint
    ) {
      return true;
    }

    switch (rule.match_strategy) {
      case "module_assessment_grade":
        return (
          (!normalizedModuleName ||
            entry.normalizedModuleName === normalizedModuleName) &&
          (!normalizedAssessmentName ||
            entry.normalizedAssessmentName === normalizedAssessmentName) &&
          (!normalizedGradeValue || entry.gradeRaw === normalizedGradeValue)
        );
      case "module_assessment_date":
        return (
          (!normalizedModuleName ||
            entry.normalizedModuleName === normalizedModuleName) &&
          (!normalizedAssessmentName ||
            entry.normalizedAssessmentName === normalizedAssessmentName) &&
          (!rule.assessment_date ||
            entry.assessmentDate === rule.assessment_date)
        );
      case "module_only":
        return (
          !normalizedModuleName ||
          entry.normalizedModuleName === normalizedModuleName
        );
      case "entry_fingerprint":
      default:
        return false;
    }
  };
};

const parseCsvToEntries = (rawCsv, { parserVersion = "v1" } = {}) => {
  const result = Papa.parse(rawCsv, {
    header: true,
    delimiter: ";",
    skipEmptyLines: "greedy",
    transformHeader: (header) => String(header || "").trim(),
  });

  const entries = [];
  const skippedRows = [];

  result.data.forEach((row, index) => {
    const moduleName = String(row.Module || "").trim();
    const rawAssessmentName = String(row["Épreuve"] || "").trim();
    const assessmentName = extractAssessmentName(rawAssessmentName);

    if (!moduleName && !assessmentName) {
      skippedRows.push({ rowNumber: index + 2, reason: "empty_row" });
      return;
    }

    const coefficient = parseFrenchNumber(
      row["Coefficient de l'Épreuve dans le Module"],
    );
    const grade = parseGrade(row.Notes);

    const entry = {
      id: null,
      rowNumber: index + 2,
      parserVersion,
      moduleName,
      normalizedModuleName: normalizeLabel(moduleName),
      rawAssessmentName,
      assessmentName,
      normalizedAssessmentName: normalizeLabel(assessmentName),
      assessmentType: String(row["Type de contrôle"] || "").trim(),
      normalizedAssessmentType: normalizeLabel(row["Type de contrôle"]),
      assessmentDetail: String(row["Détail sur le contrôle"] || "").trim(),
      coefficient: coefficient ?? 0,
      startAt: String(row["Début"] || "").trim(),
      endAt: String(row.Fin || "").trim(),
      assessmentDate:
        parseAssessmentDate(row["Début"]) || parseAssessmentDate(row.Fin),
      appreciation: String(row.Appréciation || "").trim(),
      ...grade,
    };

    entry.fingerprint = buildFingerprint(entry);
    entry.id = entry.fingerprint;
    entries.push(entry);
  });

  return {
    entries,
    diagnostics: {
      parserVersion,
      csvRowCount: result.data.length,
      parsedEntryCount: entries.length,
      skippedRows,
      parseErrors: result.errors.map((error) => ({
        code: error.code,
        message: error.message,
        row: error.row,
        type: error.type,
      })),
    },
  };
};

const buildGradesView = ({
  entries,
  userGroup,
  coefficients,
  hiddenRules = [],
}) => {
  const matchers = hiddenRules.map((rule) => ({
    rule,
    match: buildRuleMatcher(rule),
  }));

  const hiddenEntries = [];
  const visibleEntries = [];
  const matchedRuleIds = new Set();

  entries.forEach((entry) => {
    const matched = matchers.find(({ match }) => match(entry));
    if (matched) {
      matchedRuleIds.add(matched.rule.id);
      hiddenEntries.push({
        ...entry,
        hiddenByRuleId: matched.rule.id,
      });
      return;
    }

    visibleEntries.push(entry);
  });

  const moduleMap = new Map();
  visibleEntries.forEach((entry) => {
    if (!moduleMap.has(entry.moduleName)) {
      moduleMap.set(entry.moduleName, []);
    }
    moduleMap.get(entry.moduleName).push(entry);
  });

  const moduleSummaries = Array.from(moduleMap.entries()).map(
    ([moduleName, moduleEntries]) =>
      buildModuleSummary(moduleName, moduleEntries),
  );

  const moduleConfigMap = new Map();
  const ueSections = [];
  const coefficientsGroup =
    userGroup && coefficients && coefficients.groups
      ? coefficients.groups[userGroup]
      : null;

  if (coefficientsGroup?.UE) {
    coefficientsGroup.UE.forEach((ueObj) => {
      const ueName = Object.keys(ueObj)[0];
      const ueData = ueObj[ueName][0];
      const modules = [];
      let uePoints = 0;
      let ueCoeff = 0;

      Object.entries(ueData.enseignements[0]).forEach(
        ([configuredModuleName, moduleCoefficient]) => {
          moduleConfigMap.set(normalizeLabel(configuredModuleName), {
            ueName,
            configuredModuleName,
            moduleCoefficient,
          });

          const summary = moduleSummaries.find(
            (moduleSummary) =>
              moduleSummary.normalizedModuleName ===
              normalizeLabel(configuredModuleName),
          );

          if (!summary) {
            return;
          }

          const moduleWithCoef = {
            ...summary,
            configuredModuleName,
            coefficient: moduleCoefficient,
          };

          if (moduleWithCoef.average !== null) {
            uePoints += moduleWithCoef.average * moduleCoefficient;
            ueCoeff += moduleCoefficient;
          }

          modules.push(moduleWithCoef);
        },
      );

      ueSections.push({
        ueName,
        coefficient: ueData.coef,
        average: ueCoeff > 0 ? uePoints / ueCoeff : null,
        totals: {
          totalPoints: uePoints,
          totalCoefficient: ueCoeff,
        },
        modules,
      });
    });
  }

  const unmappedModules = moduleSummaries
    .filter(
      (moduleSummary) =>
        !moduleConfigMap.has(moduleSummary.normalizedModuleName),
    )
    .map((moduleSummary) => ({
      ...moduleSummary,
      reason: coefficientsGroup
        ? "module_not_found_in_coefficients"
        : "no_coefficients_for_user_group",
    }));

  return {
    userGroup: userGroup || null,
    hasCoefficients: Boolean(coefficientsGroup),
    hiddenRuleCount: hiddenRules.length,
    visibleEntryCount: visibleEntries.length,
    hiddenEntryCount: hiddenEntries.length,
    matchedHiddenRuleIds: Array.from(matchedRuleIds),
    unmatchedHiddenRuleIds: hiddenRules
      .map((rule) => rule.id)
      .filter((ruleId) => !matchedRuleIds.has(ruleId)),
    modules: moduleSummaries,
    ueSections,
    unmappedModules,
    hiddenEntries,
    diagnostics: {
      moduleCount: moduleSummaries.length,
      ueCount: ueSections.length,
      unmappedModuleCount: unmappedModules.length,
    },
  };
};

module.exports = {
  buildGradesView,
  normalizeLabel,
  parseCsvToEntries,
};
