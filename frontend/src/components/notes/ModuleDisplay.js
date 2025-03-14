import React, { useState } from "react";
import GradeSimulator from "./GradeSimulator";

const ModuleDisplay = ({
  moduleData,
  moduleName,
  isExpanded,
  toggleModule,
  average,
  simulatedGrades,
  updateSimulatedGrade,
  removeSimulatedGrade,
  addSimulatedGrade,
  ueName,
  moduleCoef,
  onGradeEdit, // Nouveau prop
  modifiedGrades, // Nouveau prop
}) => {
  const [editingGrade, setEditingGrade] = useState(null);

  const handleGradeEdit = (note) => {
    if (editingGrade) {
      onGradeEdit(moduleName, editingGrade.index, note);
      setEditingGrade(null);
    }
  };

  return (
    <div className="module">
      <div
        className={`module-header ${isExpanded ? "expanded" : ""}`}
        onClick={() => toggleModule(moduleName, ueName)}
      >
        <h3>{moduleName}</h3>
        <div className="header-right">
          {moduleCoef && <span className="coef">Coef {moduleCoef}</span>}
          <span className={`moyenne ${average.class}`}>{average.value}</span>
        </div>
      </div>

      <div className={`module-content ${isExpanded ? "expanded" : ""}`}>
        {moduleData.epreuves.map((epreuve, index) => (
          <div key={index} className="epreuve">
            <h3>{epreuve["Épreuve"].split("- ").pop()}</h3>
            <p>{epreuve["Type de contrôle"]}</p>
            <p>{epreuve["Début"]}</p>
            <div className="grade-info">
              <span>
                Coef {epreuve["Coefficient de l'Épreuve dans le Module"]}
              </span>
              <div
                className={`grade-value ${
                  editingGrade?.index === index ? "editing" : ""
                }`}
                onClick={() =>
                  !editingGrade &&
                  !["V", "NV"].includes(epreuve["Notes"]) &&
                  setEditingGrade({
                    index,
                    value: parseFloat(epreuve["Notes"]),
                  })
                }
              >
                {editingGrade?.index === index ? (
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="0.25"
                    value={editingGrade.value} // Modification: composant contrôlé
                    autoFocus
                    onChange={(e) =>
                      setEditingGrade({
                        ...editingGrade,
                        value: e.target.value,
                      })
                    }
                    onBlur={(e) => handleGradeEdit(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleGradeEdit(e.target.value);
                      } else if (e.key === "Escape") {
                        setEditingGrade(null);
                      }
                    }}
                  />
                ) : (
                  <div className="grade-display">
                    {modifiedGrades?.[moduleName]?.[index] !== undefined && (
                      <>
                        <span className="original-grade">
                          {epreuve["Notes"]}
                        </span>
                        <span className="arrow">→</span>
                        <span className="modified-grade">
                          {modifiedGrades[moduleName][index]}
                        </span>
                        <button
                          className="reset-grade"
                          onClick={(e) => {
                            e.stopPropagation();
                            onGradeEdit(moduleName, index, null);
                          }}
                          title="Restaurer la note originale"
                        >
                          ↺
                        </button>
                      </>
                    )}
                    {modifiedGrades?.[moduleName]?.[index] === undefined && (
                      <>
                        <b>{epreuve["Notes"]}</b>
                        <span className="edit-icon">✎</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {isExpanded && (
          <GradeSimulator
            moduleName={moduleName}
            simulatedGrades={simulatedGrades}
            updateSimulatedGrade={updateSimulatedGrade}
            removeSimulatedGrade={removeSimulatedGrade}
            addSimulatedGrade={addSimulatedGrade}
            ueName={ueName}
          />
        )}
      </div>
    </div>
  );
};

export default ModuleDisplay;
