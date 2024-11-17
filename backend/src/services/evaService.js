const fs = require("fs");
const path = require("path");

const saveEvaluation = async (evaluation) => {
  const dataPath = path.join(__dirname, "../data/evaluations.json");
  let evaluations = [];

  if (fs.existsSync(dataPath)) {
    evaluations = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  }

  // Trouver l'évaluation existante
  const index = evaluations.findIndex(
    (e) =>
      e.userName === evaluation.userName &&
      e.eventTitle === evaluation.eventTitle
  );

  if (index !== -1) {
    // Mettre à jour l'évaluation existante
    evaluations[index] = { ...evaluation, date: new Date() };
  } else {
    // Ajouter une nouvelle évaluation
    evaluations.push({ ...evaluation, date: new Date() });
  }

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

const getEvaluation = async (userName, eventTitle) => {
  const dataPath = path.join(__dirname, "../data/evaluations.json");
  if (fs.existsSync(dataPath)) {
    const evaluations = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    return evaluations.find(
      (e) => e.userName === userName && e.eventTitle === eventTitle
    );
  }
  return null;
};

module.exports = { saveEvaluation, hasEvaluated, getEvaluation };