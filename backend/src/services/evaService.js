const fs = require("fs");
const path = require("path");
const ExcelJS = require('exceljs');

const getUserGroup = (userName) => {
  const usersPath = path.join(__dirname, "../data/users.json");
  const users = JSON.parse(fs.readFileSync(usersPath, "utf-8"));
  return users[userName]?.group;
};

const getEvaluationConfig = (userGroup) => {
  const configPath = path.join(__dirname, "../data/evaluation-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  return userGroup && config.groups[userGroup] ? config.groups[userGroup] : null;
};

const sanitizeText = (text) => {
  if (typeof text !== 'string') return '';
  return text
    .trim()
    .replace(/[<>]/g, '') // Supprime les balises HTML
    .replace(/['"]/g, '') // Supprime les guillemets
    .substring(0, 500);    // Limite la longueur
};

const validateAnswers = (answers, config) => {
  const validatedAnswers = {};
  
  for (const [id, answer] of Object.entries(answers)) {
    const question = config.questions.find(q => q.id === parseInt(id));
    if (!question) continue;

    if (question.type === 'likert') {
      const answerNum = parseInt(answer);
      if (answerNum >= 0 && answerNum < question.options.length) {
        validatedAnswers[id] = answerNum;
      }
    } else if (question.type === 'text') {
      if (typeof answer === 'string') {
        const sanitized = sanitizeText(answer);
        if (sanitized.length <= question.maxLength) {
          validatedAnswers[id] = sanitized;
        }
      }
    }
  }

  return validatedAnswers;
};

const saveEvaluation = async (evaluation) => {
  const dataPath = path.join(__dirname, "../data/evaluations.json");
  
  // La configuration est maintenant passée directement
  const { config, userGroup } = evaluation;
  if (!config) {
    throw new Error("Configuration manquante");
  }

  let evaluations = [];
  if (fs.existsSync(dataPath)) {
    evaluations = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  }

  // Vérifier si l'évaluation existe déjà
  if (evaluations.some(e => 
    e.userName === evaluation.userName && 
    e.eventTitle === evaluation.eventTitle
  )) {
    throw new Error("Vous avez déjà évalué cet enseignement");
  }

  const validatedAnswers = validateAnswers(evaluation.answers, config);

  // Vérifier les réponses requises
  const missingRequired = config.questions
    .filter(q => q.required)
    .some(q => !(q.id.toString() in validatedAnswers));

  if (missingRequired) {
    throw new Error("Réponses incomplètes ou invalides");
  }

  // Ajouter l'évaluation avec le groupe
  evaluations.push({
    userName: evaluation.userName,
    eventTitle: evaluation.eventTitle,
    answers: validatedAnswers,
    group: userGroup, // Ajouter le groupe
    date: new Date()
  });
  
  fs.writeFileSync(dataPath, JSON.stringify(evaluations, null, 2), "utf-8");
};

const hasEvaluated = async (userName, eventTitle) => {
  const dataPath = path.join(__dirname, "../data/evaluations.json");
  if (fs.existsSync(dataPath)) {
    const evaluations = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    return evaluations.some(
      (e) => e.userName === userName && e.eventTitle === eventTitle
    );
  }
  return false;
};

const generateExcelReport = async () => {
  const configPath = path.join(__dirname, "../data/evaluation-config.json");
  const dataPath = path.join(__dirname, "../data/evaluations.json");
  
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const evaluations = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  const workbook = new ExcelJS.Workbook();
  
  // Grouper les évaluations par groupe
  const evaluationsByGroup = evaluations.reduce((acc, eval) => {
    const group = eval.group || 'Sans Groupe';
    if (!acc[group]) acc[group] = [];
    acc[group].push(eval);
    return acc;
  }, {});

  // Créer une feuille pour chaque groupe
  Object.entries(evaluationsByGroup).forEach(([group, groupEvaluations]) => {
    const worksheet = workbook.addWorksheet(`Évaluations ${group}`);
    const groupConfig = config.groups[group];
    
    if (!groupConfig) return;

    // Style pour les en-têtes
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4267ce' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    // Style pour les cellules
    const cellStyle = {
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    // Création des en-têtes
    const headers = ['Date', 'Événement'];
    groupConfig.questions.forEach(question => {
      headers.push(question.text);
    });
    
    // Ajout des en-têtes avec style
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 40; // Hauteur de la ligne d'en-tête
    headerRow.eachCell((cell) => {
      cell.style = headerStyle;
    });

    // Style alterné pour les lignes de données
    groupEvaluations.forEach((evaluation, index) => {
      const row = [
        new Date(evaluation.date).toLocaleDateString('fr-FR'),
        evaluation.eventTitle
      ];

      groupConfig.questions.forEach(question => {
        const answer = evaluation.answers[question.id];
        if (question.type === 'likert') {
          row.push(question.options[answer] || '');
        } else {
          row.push(answer || '');
        }
      });

      const dataRow = worksheet.addRow(row);
      dataRow.height = 25; // Hauteur des lignes de données

      // Style alterné pour les lignes
      const rowStyle = {
        ...cellStyle,
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: index % 2 === 0 ? 'FFFFFF' : 'F0F0F0' }
        }
      };

      dataRow.eachCell((cell) => {
        cell.style = rowStyle;
      });
    });

    // Ajuster la largeur des colonnes
    worksheet.columns.forEach((column, index) => {
      const maxLength = Math.max(
        ...worksheet.getColumn(index + 1).values
          .filter(value => value)
          .map(value => String(value).length)
      );
      column.width = Math.min(Math.max(15, maxLength + 2), 40);
    });

    // Figer la première ligne
    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }
    ];
  });

  return workbook;
};

module.exports = { 
  saveEvaluation, 
  hasEvaluated, 
  getEvaluationConfig,
  generateExcelReport,
  getUserGroup 
};