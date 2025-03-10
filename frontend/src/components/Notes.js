import axios from "axios";
import Papa from "papaparse";
import React, { useCallback, useContext, useEffect, useState } from "react";
import { UserContext } from "../App";

const Notes = () => {
  const [expandedModules, setExpandedModules] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { userName } = useContext(UserContext);
  const [coefficients, setCoefficients] = useState(null);
  const [organizedModules, setOrganizedModules] = useState({});
  const [userGroup, setUserGroup] = useState(null); // Ajouter cet état
  const [activeUE, setActiveUE] = useState(null);
  const [unlistedModules, setUnlistedModules] = useState([]);
  const [simulatedGrades, setSimulatedGrades] = useState({});

  const processGrades = useCallback(
    (grades) => {
      if (!coefficients || !userGroup) {
        // Quand aucun groupe n'est trouvé, afficher tous les modules sans groupement UE
        const processedModules = {};

        grades.forEach((grade) => {
          const moduleName = grade["Module"];
          if (!processedModules[moduleName]) {
            processedModules[moduleName] = {
              epreuves: [],
              totalPoints: 0,
              totalCoeff: 0,
              vCount: 0,
              nvCount: 0,
              coef: 1, // Coefficient par défaut
            };
          }

          processedModules[moduleName].epreuves.push(grade);

          const note = parseFloat(grade["Notes"].replace(",", ".")) || 0;
          const coeff =
            parseFloat(grade["Coefficient de l'Épreuve dans le Module"]) || 0;

          if (
            grade["Notes"] !== "V" &&
            grade["Notes"] !== "NV" &&
            coeff !== 0
          ) {
            processedModules[moduleName].totalPoints += note * coeff;
            processedModules[moduleName].totalCoeff += coeff;
          } else if (grade["Notes"] === "V") {
            processedModules[moduleName].vCount += 1;
          } else if (grade["Notes"] === "NV") {
            processedModules[moduleName].nvCount += 1;
          }
        });

        // Afficher les modules directement dans la grille sans sections UE
        setOrganizedModules({
          modules: processedModules,
        });
        return;
      }

      const processedModules = {};
      const organizedByUE = {};
      const unmatched = new Set();

      // Traiter d'abord tous les grades
      grades.forEach((grade) => {
        const moduleName = grade["Module"];
        if (!processedModules[moduleName]) {
          processedModules[moduleName] = {
            epreuves: [],
            totalPoints: 0,
            totalCoeff: 0,
            vCount: 0,
            nvCount: 0,
          };
        }

        processedModules[moduleName].epreuves.push(grade);

        const note = parseFloat(grade["Notes"].replace(",", ".")) || 0;
        const coeff =
          parseFloat(grade["Coefficient de l'Épreuve dans le Module"]) || 0;

        if (grade["Notes"] !== ("V" || "NV") && coeff !== 0) {
          processedModules[moduleName].totalPoints += note * coeff;
          processedModules[moduleName].totalCoeff += coeff;
        } else if (grade["Notes"] === "V") {
          processedModules[moduleName].vCount += 1;
        } else if (grade["Notes"] === "NV") {
          processedModules[moduleName].nvCount += 1;
        }
      });

      // Organiser par UE et identifier les modules non listés
      let moduleFound = new Set();
      coefficients.groups[userGroup].UE.forEach((ueObj) => {
        const ueName = Object.keys(ueObj)[0];
        const ueData = ueObj[ueName][0];

        organizedByUE[ueName] = {
          coef: ueData.coef,
          modules: {},
          moyenne: 0,
          totalPoints: 0,
          totalCoeff: 0,
        };

        Object.entries(ueData.enseignements[0]).forEach(
          ([moduleName, moduleCoef]) => {
            moduleFound.add(moduleName);
            if (processedModules[moduleName]) {
              const moduleData = processedModules[moduleName];
              organizedByUE[ueName].modules[moduleName] = {
                ...moduleData,
                coef: moduleCoef,
              };

              if (moduleData.totalCoeff > 0) {
                const moduleMoyenne =
                  moduleData.totalPoints / moduleData.totalCoeff;
                organizedByUE[ueName].totalPoints += moduleMoyenne * moduleCoef;
                organizedByUE[ueName].totalCoeff += moduleCoef;
              }
            }
          }
        );

        if (organizedByUE[ueName].totalCoeff > 0) {
          organizedByUE[ueName].moyenne =
            organizedByUE[ueName].totalPoints /
            organizedByUE[ueName].totalCoeff;
        }
      });

      // Identifier les modules non listés
      Object.keys(processedModules).forEach((moduleName) => {
        if (!moduleFound.has(moduleName)) {
          unmatched.add(moduleName);
        }
      });

      // Ajouter une section spéciale pour les modules non listés si nécessaire
      if (unmatched.size > 0) {
        setUnlistedModules(Array.from(unmatched));
        organizedByUE["⚠️ Modules non référencés"] = {
          coef: 0,
          modules: Object.fromEntries(
            Array.from(unmatched).map((name) => [
              name,
              { ...processedModules[name], coef: 1 },
            ])
          ),
          moyenne: 0,
        };
      }

      setOrganizedModules(organizedByUE);
      setExpandedModules(
        Object.keys(processedModules).reduce((acc, moduleName) => {
          acc[moduleName] = false;
          return acc;
        }, {})
      );
    },
    [coefficients, userGroup]
  );

  const fetchCSVData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const downloadResponse = await axios.post(
        "/api/download-csv",
        {
          password,
        },
        {
          credentials: true,
        }
      );

      if (downloadResponse.data.success) {
        const csvDataResponse = await axios.get(
          `/api/csv-data?path=${downloadResponse.data.filePath}`
        );
        Papa.parse(csvDataResponse.data, {
          header: true,
          complete: (results) => {
            processGrades(results.data);
            setIsLoading(false);
          },
        });
      } else {
        throw new Error("Échec du téléchargement du CSV");
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données CSV:", error);
      setError("Erreur de chargement des notes. Veuillez réessayer plus tard.");
      setIsLoading(false);
    }
  }, [password, processGrades]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchCSVData();
    }
  }, [isLoggedIn, fetchCSVData]);

  useEffect(() => {
    const fetchCoefficients = async () => {
      try {
        const response = await fetch(`/api/coef/`, {
          credentials: "include",
        });
        const data = await response.json();
        setCoefficients(data);
        // Récupérer le groupe depuis la réponse
        const userGroupFromResponse = Object.keys(data.groups)[0];
        setUserGroup(userGroupFromResponse);
      } catch (error) {
        console.error(
          "Erreur lors de la récupération des coefficients:",
          error
        );
      }
    };

    if (userName) {
      fetchCoefficients();
    }
  }, [userName]);

  const recalculateAllUEAverages = useCallback(() => {
    if (!coefficients || !userGroup) {
      const modules = organizedModules.modules;
      if (!modules) return organizedModules;

      Object.keys(modules).forEach((moduleName) => {
        // Recalculer depuis zéro
        let basePoints = 0;
        let baseCoeff = 0;
        modules[moduleName].epreuves.forEach((epreuve) => {
          const note = parseFloat(epreuve["Notes"].replace(",", ".")) || 0;
          const coeff =
            parseFloat(epreuve["Coefficient de l'Épreuve dans le Module"]) || 0;
          if (epreuve["Notes"] !== ("V" || "NV") && coeff !== 0) {
            basePoints += note * coeff;
            baseCoeff += coeff;
          }
        });

        // Ajouter les notes simulées
        const simulated = simulatedGrades[moduleName] || [];
        simulated.forEach((grade) => {
          basePoints += grade.note * grade.coefficient;
          baseCoeff += grade.coefficient;
        });

        modules[moduleName].totalPoints = basePoints;
        modules[moduleName].totalCoeff = baseCoeff;
      });

      return {
        modules: modules,
      };
    }

    // Logique de calcul par UE
    const updatedModules = { ...organizedModules };

    Object.keys(updatedModules).forEach((ueName) => {
      const ueData = updatedModules[ueName];
      let ueTotalPoints = 0;
      let ueTotalCoeff = 0;

      Object.entries(ueData.modules).forEach(([moduleName, moduleData]) => {
        // Recalculer la moyenne du module depuis zéro
        let basePoints = 0;
        let baseCoeff = 0;
        moduleData.epreuves.forEach((epreuve) => {
          const note = parseFloat(epreuve["Notes"].replace(",", ".")) || 0;
          const coeff =
            parseFloat(epreuve["Coefficient de l'Épreuve dans le Module"]) || 0;
          if (epreuve["Notes"] !== ("V" || "NV") && coeff !== 0) {
            basePoints += note * coeff;
            baseCoeff += coeff;
          }
        });

        // Ajouter les notes simulées
        const simulated = simulatedGrades[moduleName] || [];
        simulated.forEach((grade) => {
          basePoints += grade.note * grade.coefficient;
          baseCoeff += grade.coefficient;
        });

        // Calculer la moyenne du module
        moduleData.totalPoints = basePoints;
        moduleData.totalCoeff = baseCoeff;
        if (baseCoeff > 0) {
          const moduleMoyenne = basePoints / baseCoeff;
          ueTotalPoints += moduleMoyenne * moduleData.coef;
          ueTotalCoeff += moduleData.coef;
        }
      });

      // Mise à jour de la moyenne de l'UE
      if (ueTotalCoeff > 0) {
        ueData.moyenne = ueTotalPoints / ueTotalCoeff;
        ueData.totalPoints = ueTotalPoints;
        ueData.totalCoeff = ueTotalCoeff;
      }
    });

    return updatedModules;
  }, [organizedModules, simulatedGrades, coefficients, userGroup]);

  useEffect(() => {
    if (Object.keys(simulatedGrades).length > 0) {
      const updatedModules = recalculateAllUEAverages();
      setOrganizedModules(updatedModules);
    }
  }, [simulatedGrades, recalculateAllUEAverages]);

  const addSimulatedGrade = (moduleName, ueName, note, coefficient) => {
    setSimulatedGrades((prev) => ({
      ...prev,
      [moduleName]: [
        ...(prev[moduleName] || []),
        {
          id: Date.now(),
          note: parseFloat(note),
          coefficient: parseFloat(coefficient),
        },
      ],
    }));
  };

  const removeSimulatedGrade = (moduleName, gradeId) => {
    setSimulatedGrades((prev) => ({
      ...prev,
      [moduleName]: (prev[moduleName] || []).filter(
        (grade) => grade.id !== gradeId
      ),
    }));
  };

  const updateSimulatedGrade = (moduleName, gradeId, newNote) => {
    setSimulatedGrades((prev) => ({
      ...prev,
      [moduleName]: (prev[moduleName] || []).map((grade) =>
        grade.id === gradeId ? { ...grade, note: parseFloat(newNote) } : grade
      ),
    }));
  };

  const calculateAverage = (module, moduleName) => {
    // Repartir de zéro pour éviter d'ajouter plusieurs fois
    let basePoints = 0;
    let baseCoeff = 0;

    // Ajouter les épreuves du module
    module.epreuves.forEach((epreuve) => {
      const note = parseFloat(epreuve["Notes"].replace(",", ".")) || 0;
      const coeff =
        parseFloat(epreuve["Coefficient de l'Épreuve dans le Module"]) || 0;
      const letterGrade = ["A", "B", "C", "D", "E", "F"].includes(
        epreuve["Notes"]
      );
      if (epreuve["Notes"] !== ("V" || "NV") && !letterGrade && coeff !== 0) {
        basePoints += note * coeff;
        baseCoeff += coeff;
      }
    });

    // Ajouter les notes simulées
    const simulated = simulatedGrades[moduleName] || [];
    simulated.forEach((grade) => {
      basePoints += grade.note * grade.coefficient;
      baseCoeff += grade.coefficient;
    });

    const hasNumericNotes = baseCoeff > 0;
    const onlyV = module.vCount > 0 && module.nvCount === 0 && !hasNumericNotes;
    const letterGrade =
      module.epreuves.filter((epreuve) =>
        ["A", "B", "C", "D", "E", "F"].includes(epreuve["Notes"])
      ).length > 0;
    const hasNV = module.nvCount > 0;

    if (hasNumericNotes) {
      const average = (basePoints / baseCoeff).toFixed(2);
      return {
        value: average,
        class: average >= 10 ? "vert" : average >= 7 ? "orange" : "rouge",
      };
    } else if (hasNV) {
      return { value: "Non Validé", class: "rouge" };
    } else if (onlyV || letterGrade) {
      return { value: "Validé", class: "vert" };
    } else {
      return { value: "N/A", class: "" };
    }
  };

  const toggleModule = (moduleName, ueName) => {
    setExpandedModules((prev) => {
      // Si pas de coefficients/groupe, gestion simple des modules
      if (!coefficients || !userGroup) {
        return {
          ...prev,
          [moduleName]: !prev[moduleName],
        };
      }

      // Sinon, gestion par UE (code existant)
      if (activeUE !== ueName) {
        const allClosed = Object.keys(prev).reduce((acc, key) => {
          acc[key] = false;
          return acc;
        }, {});

        const updatedModules = { ...allClosed };
        Object.entries(organizedModules[ueName].modules).forEach(([name]) => {
          updatedModules[name] = true;
        });

        setActiveUE(ueName);
        return updatedModules;
      }

      const allUEModulesOpen = Object.entries(
        organizedModules[ueName].modules
      ).every(([name]) => prev[name]);

      if (allUEModulesOpen) {
        const allClosed = Object.keys(prev).reduce((acc, key) => {
          acc[key] = false;
          return acc;
        }, {});
        setActiveUE(null);
        return allClosed;
      }

      const updatedModules = { ...prev };
      Object.entries(organizedModules[ueName].modules).forEach(([name]) => {
        updatedModules[name] = true;
      });
      return updatedModules;
    });
  };

  const handleLogin = (event) => {
    event.preventDefault();
    if (password) {
      setIsLoggedIn(true);
      // Ajout : retirer le focus du champ password après connexion
      event.target.querySelector('input[type="password"]').blur();
    } else {
      alert("Veuillez entrer un mot de passe.");
    }
  };

  const getAverageClass = (average) => {
    return average >= 10 ? "vert" : average >= 7 ? "orange" : "rouge";
  };

  return (
    <div className="container">
      <h1 className="page-title">Mes notes</h1>
      <p className="page-subtitle">
        Consultez et simulez vos notes en temps réel
      </p>

      {!isLoggedIn && (
        <div className="login-container">
          <form className="login-form" onSubmit={handleLogin}>
            <div className="input-group">
              <input type="hidden" value={userName} />
              <input
                type="password"
                placeholder=" "
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                // Ajout : stopper la propagation des touches pour éviter que l'écouteur global ne bloque la saisie
                required
              />
              <label>Mot de passe ENT</label>
              <span className="input-line"></span>
            </div>
            <button type="submit" className="submit-button">
              <span>Se connecter</span>
              <div className="button-loader"></div>
            </button>
          </form>
        </div>
      )}

      {isLoggedIn && (
        <>
          {isLoading && (
            <div className="loading-container-notes">
              <div className="progress-container">
                <div className="progress-bar">
                  <div className="progress-fill"></div>
                </div>
                <div className="loading-status">
                  <div className="loading-status-dot"></div>
                  <div className="loading-status-text">
                    Récupération des notes en cours
                  </div>
                </div>
              </div>
            </div>
          )}
          {error && <p className="error">{error}</p>}
          {!isLoading && !error && (
            <>
              {unlistedModules.length > 0 && (
                <div className="warning-message">
                  ⚠️ Certains modules ne sont pas correctement référencés dans
                  notre base de données :{unlistedModules.join(", ")}
                  <br />
                  <span className="feedback-hint">
                    N'hésitez pas à nous signaler ce problème via le menu
                    "Feedback" dans l'en-tête pour nous aider à l'améliorer !
                  </span>
                </div>
              )}
              <div className="grid">
                {!coefficients || !userGroup
                  ? // Affichage sans groupement UE
                    Object.entries(organizedModules.modules || {}).map(
                      ([moduleName, moduleData]) => {
                        const average = calculateAverage(
                          moduleData,
                          moduleName
                        );
                        const isExpanded = expandedModules[moduleName];
                        return (
                          <div key={moduleName} className="module">
                            <div
                              className={`module-header ${
                                isExpanded ? "expanded" : ""
                              }`}
                              onClick={() => toggleModule(moduleName)}
                            >
                              <h3>{moduleName}</h3>
                              <div className="header-right">
                                <span className={`moyenne ${average.class}`}>
                                  {average.value}
                                </span>
                              </div>
                            </div>
                            <div
                              className={`module-content ${
                                isExpanded ? "expanded" : ""
                              }`}
                            >
                              {moduleData.epreuves.map((epreuve, index) => (
                                <div key={index} className="epreuve">
                                  <h3>
                                    {epreuve["Épreuve"].split("- ").pop()}
                                  </h3>
                                  <p>{epreuve["Type de contrôle"]}</p>
                                  <p>{epreuve["Début"]}</p>
                                  <p>
                                    Coef{" "}
                                    {
                                      epreuve[
                                        "Coefficient de l'Épreuve dans le Module"
                                      ]
                                    }{" "}
                                    - <b>{epreuve["Notes"]}</b>
                                  </p>
                                </div>
                              ))}

                              {isExpanded && (
                                <div className="simulate-grade">
                                  {(simulatedGrades[moduleName] || []).length >
                                    0 && (
                                    <div className="simulated-grades">
                                      <h4>Notes simulées</h4>
                                      {simulatedGrades[moduleName].map(
                                        (grade) => (
                                          <div
                                            key={grade.id}
                                            className="simulated-grade"
                                          >
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
                                                  updateSimulatedGrade(
                                                    moduleName,
                                                    grade.id,
                                                    e.target.value
                                                  );
                                                  e.target
                                                    .closest(
                                                      ".note-input-container"
                                                    )
                                                    .setAttribute(
                                                      "data-value",
                                                      `Note: ${e.target.value}/20`
                                                    );
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
                                                  updateSimulatedGrade(
                                                    moduleName,
                                                    grade.id,
                                                    e.target.value
                                                  )
                                                }
                                                onKeyDown={(e) =>
                                                  e.stopPropagation()
                                                }
                                              />
                                            </div>
                                            <div className="grade-actions">
                                              <span>
                                                Coef: {grade.coefficient}
                                              </span>
                                              <button
                                                onClick={() =>
                                                  removeSimulatedGrade(
                                                    moduleName,
                                                    grade.id
                                                  )
                                                }
                                              >
                                                Supprimer
                                              </button>
                                            </div>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  )}

                                  <h4>Simuler une note</h4>
                                  <form
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      const formData = new FormData(e.target);
                                      const note = formData.get("note");
                                      addSimulatedGrade(
                                        moduleName,
                                        null, // Remplacer ueName par null quand il n'y a pas d'UE
                                        note,
                                        formData.get("coefficient")
                                      );
                                      e.target.reset();
                                    }}
                                  >
                                    <div
                                      className="note-input-container"
                                      data-value="Note: 0/20"
                                    >
                                      <input
                                        type="range"
                                        name="note"
                                        min="0"
                                        max="20"
                                        step="0.25"
                                        className="note-slider"
                                        onChange={(e) => {
                                          e.target.nextElementSibling.value =
                                            e.target.value;
                                          e.target
                                            .closest(".note-input-container")
                                            .setAttribute(
                                              "data-value",
                                              `Note: ${e.target.value}/20`
                                            );
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
                                          e.target.previousElementSibling.value =
                                            e.target.value;
                                          e.target
                                            .closest(".note-input-container")
                                            .setAttribute(
                                              "data-value",
                                              `Note: ${e.target.value}/20`
                                            );
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
                              )}
                            </div>
                          </div>
                        );
                      }
                    )
                  : // Affichage avec groupement UE (code existant)
                    Object.entries(organizedModules).map(([ueName, ueData]) => (
                      <div key={ueName} className="ue-section">
                        <h2 className="ue-title">
                          {ueName}
                          {ueData.moyenne > 0 && (
                            <span
                              className={`moyenne ${getAverageClass(
                                ueData.moyenne
                              )}`}
                            >
                              {ueData.moyenne.toFixed(2)}
                            </span>
                          )}
                        </h2>
                        <div className="modules-grid">
                          {Object.entries(ueData.modules).map(
                            ([moduleName, moduleData]) => {
                              const average = calculateAverage(
                                moduleData,
                                moduleName
                              );
                              const isExpanded = expandedModules[moduleName];
                              return (
                                <div key={moduleName} className="module">
                                  <div
                                    className={`module-header ${
                                      isExpanded ? "expanded" : ""
                                    }`}
                                    onClick={() =>
                                      toggleModule(moduleName, ueName)
                                    }
                                  >
                                    <h3>{moduleName}</h3>
                                    <div className="header-right">
                                      <span className="coef">
                                        Coef {moduleData.coef}
                                      </span>
                                      <span
                                        className={`moyenne ${average.class}`}
                                      >
                                        {average.value}
                                      </span>
                                    </div>
                                  </div>
                                  <div
                                    className={`module-content ${
                                      isExpanded ? "expanded" : ""
                                    }`}
                                  >
                                    {moduleData.epreuves.map(
                                      (epreuve, index) => (
                                        <div key={index} className="epreuve">
                                          <h3>
                                            {epreuve["Épreuve"]
                                              .split("- ")
                                              .pop()}
                                          </h3>
                                          <p>{epreuve["Type de contrôle"]}</p>
                                          <p>{epreuve["Début"]}</p>
                                          <p>
                                            Coef{" "}
                                            {
                                              epreuve[
                                                "Coefficient de l'Épreuve dans le Module"
                                              ]
                                            }{" "}
                                            - <b>{epreuve["Notes"]}</b>
                                          </p>
                                        </div>
                                      )
                                    )}

                                    {isExpanded && (
                                      <div className="simulate-grade">
                                        {(simulatedGrades[moduleName] || [])
                                          .length > 0 && (
                                          <div className="simulated-grades">
                                            <h4>Notes simulées</h4>
                                            {simulatedGrades[moduleName].map(
                                              (grade) => (
                                                <div
                                                  key={grade.id}
                                                  className="simulated-grade"
                                                >
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
                                                        updateSimulatedGrade(
                                                          moduleName,
                                                          grade.id,
                                                          e.target.value
                                                        );
                                                        e.target
                                                          .closest(
                                                            ".note-input-container"
                                                          )
                                                          .setAttribute(
                                                            "data-value",
                                                            `Note: ${e.target.value}/20`
                                                          );
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
                                                        updateSimulatedGrade(
                                                          moduleName,
                                                          grade.id,
                                                          e.target.value
                                                        )
                                                      }
                                                      onKeyDown={(e) =>
                                                        e.stopPropagation()
                                                      }
                                                    />
                                                  </div>
                                                  <div className="grade-actions">
                                                    <span>
                                                      Coef: {grade.coefficient}
                                                    </span>
                                                    <button
                                                      onClick={() =>
                                                        removeSimulatedGrade(
                                                          moduleName,
                                                          grade.id
                                                        )
                                                      }
                                                    >
                                                      Supprimer
                                                    </button>
                                                  </div>
                                                </div>
                                              )
                                            )}
                                          </div>
                                        )}

                                        <h4>Simuler une note</h4>
                                        <form
                                          onSubmit={(e) => {
                                            e.preventDefault();
                                            const formData = new FormData(
                                              e.target
                                            );
                                            const note = formData.get("note");
                                            addSimulatedGrade(
                                              moduleName,
                                              ueName,
                                              note,
                                              formData.get("coefficient")
                                            );
                                            e.target.reset();
                                          }}
                                        >
                                          <div
                                            className="note-input-container"
                                            data-value="Note: 0/20"
                                          >
                                            <input
                                              type="range"
                                              name="note"
                                              min="0"
                                              max="20"
                                              step="0.25"
                                              className="note-slider"
                                              onChange={(e) => {
                                                e.target.nextElementSibling.value =
                                                  e.target.value;
                                                e.target
                                                  .closest(
                                                    ".note-input-container"
                                                  )
                                                  .setAttribute(
                                                    "data-value",
                                                    `Note: ${e.target.value}/20`
                                                  );
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
                                                e.target.previousElementSibling.value =
                                                  e.target.value;
                                                e.target
                                                  .closest(
                                                    ".note-input-container"
                                                  )
                                                  .setAttribute(
                                                    "data-value",
                                                    `Note: ${e.target.value}/20`
                                                  );
                                              }}
                                              required
                                              onKeyDown={(e) =>
                                                e.stopPropagation()
                                              }
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
                                              onKeyDown={(e) =>
                                                e.stopPropagation()
                                              }
                                            />
                                            <button type="submit">
                                              Ajouter
                                            </button>
                                          </div>
                                        </form>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Notes;
