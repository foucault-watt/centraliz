import React from "react";

const GradeSimulator = ({
  moduleName,
  simulatedGrades,
  updateSimulatedGrade,
  removeSimulatedGrade,
  addSimulatedGrade,
  ueName,
}) => {
  return (
    <div className="simulate-grade">
      {(simulatedGrades[moduleName] || []).length > 0 && (
        <div className="simulated-grades">
          <h4>Notes simulées</h4>
          {simulatedGrades[moduleName].map((grade) => (
            <div key={grade.id} className="simulated-grade">
              <div
                className="note-input-container"
                data-value={`Note: ${grade.note}/20`}
              >
                <input
                  type="range"
                  value={grade.note}
                  min="0"
                  max="20"
                  step="0.25"
                  className="note-slider"
                  onChange={(e) => {
                    updateSimulatedGrade(moduleName, grade.id, e.target.value);
                    e.target
                      .closest(".note-input-container")
                      .setAttribute("data-value", `Note: ${e.target.value}/20`);
                  }}
                />
                <input
                  type="number"
                  value={grade.note}
                  className="note-number"
                  step="0.25"
                  min="0"
                  max="20"
                  onChange={(e) =>
                    updateSimulatedGrade(moduleName, grade.id, e.target.value)
                  }
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              <div className="grade-actions">
                <span>Coef: {grade.coefficient}</span>
                <button
                  onClick={() => removeSimulatedGrade(moduleName, grade.id)}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h4>Simuler une note</h4>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          addSimulatedGrade(
            moduleName,
            ueName,
            formData.get("note"),
            formData.get("coefficient")
          );
          e.target.reset();
        }}
      >
        <div className="note-input-container" data-value="Note: 0/20">
          <input
            type="range"
            name="note"
            min="0"
            max="20"
            step="0.25"
            className="note-slider"
            onChange={(e) => {
              e.target.nextElementSibling.value = e.target.value;
              e.target
                .closest(".note-input-container")
                .setAttribute("data-value", `Note: ${e.target.value}/20`);
            }}
            defaultValue="0"
          />
          <input
            type="number"
            className="note-number"
            step="0.25"
            min="0"
            max="20"
            placeholder="Note"
            onChange={(e) => {
              e.target.previousElementSibling.value = e.target.value;
              e.target
                .closest(".note-input-container")
                .setAttribute("data-value", `Note: ${e.target.value}/20`);
            }}
            required
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <div className="form-bottom">
          <input
            type="number"
            name="coefficient"
            step="1"
            min="0"
            placeholder="Coef"
            required
            onKeyDown={(e) => e.stopPropagation()}
          />
          <button type="submit">Ajouter</button>
        </div>
      </form>
    </div>
  );
};

export default GradeSimulator;
