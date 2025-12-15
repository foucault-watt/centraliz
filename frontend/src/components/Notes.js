import axios from "axios";
import Papa from "papaparse";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { UserContext } from "../App";
import ModuleDisplay from "./notes/ModuleDisplay";

const Notes = () => {
  const [expandedModules, setExpandedModules] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState("");
  const [entUsername, setEntUsername] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showManualLogin, setShowManualLogin] = useState(false);
  const { user, setUser } = useContext(UserContext);
  const userName = user?.userName;

  useEffect(() => {
    if (user?.ent_username && !entUsername) {
      setEntUsername(user.ent_username);
    }
  }, [user?.ent_username]);
  const [coefficients, setCoefficients] = useState(null);
  const [organizedModules, setOrganizedModules] = useState({});
  const [userGroup, setUserGroup] = useState(null); // Ajouter cet état
  const [activeUE, setActiveUE] = useState(null);
  const [unlistedModules, setUnlistedModules] = useState([]);
  const [simulatedGrades, setSimulatedGrades] = useState({});
  const [modifiedGrades, setModifiedGrades] = useState({});

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

  const fetchCSVData = useCallback(
    async (opts = {}) => {
      setIsLoading(true);
      setError(null);
      try {
        const body = {};
        // If entUsername provided via form or user has one in context
        if (opts.entUsername) body.ent_username = opts.entUsername;
        if (entUsername) body.ent_username = entUsername;
        if (password) body.password = password;
        if (opts.rememberMe !== undefined) body.rememberMe = opts.rememberMe;
        if (rememberMe !== undefined) body.rememberMe = rememberMe;

        const downloadResponse = await axios.post("/api/download-csv", body, {
          withCredentials: true,
        });

        if (downloadResponse.data.success) {
          const csvDataResponse = await axios.get(
            `/api/csv-data?path=${downloadResponse.data.filePath}`
          );
          Papa.parse(csvDataResponse.data, {
            header: true,
            complete: (results) => {
              processGrades(results.data);
              setIsLoading(false);
              hasLoadedDataRef.current = true;
            },
          });
          return true;
        } else {
          throw new Error("Échec du téléchargement du CSV");
        }
      } catch (error) {
        console.error("Erreur lors du chargement des données CSV:", error);
        setError(
          "Erreur de chargement des notes. Veuillez réessayer plus tard."
        );
        setIsLoading(false);
        return false;
      }
    },
    [password, entUsername, rememberMe, processGrades]
  );

  const hasLoadedDataRef = useRef(false);

  useEffect(() => {
    if (isLoggedIn && !hasLoadedDataRef.current) {
      fetchCSVData();
    }
  }, [isLoggedIn, fetchCSVData]);

  // Reset loaded ref when logged out to allow re-fetching if needed
  useEffect(() => {
    if (!isLoggedIn) {
      hasLoadedDataRef.current = false;
    }
  }, [isLoggedIn]);

  const handleFetchWithStoredPassword = async () => {
    setError(null);
    const ok = await fetchCSVData({});
    if (ok) {
      hasLoadedDataRef.current = true;
      setIsLoggedIn(true);
      if (setUser) setUser((prev) => ({ ...(prev || {}), hasPassword: true }));
    }
  };

  const handleSubmitCredentials = async (e) => {
    e.preventDefault();
    setError(null);
    const ok = await fetchCSVData({ entUsername: entUsername, rememberMe });
    if (ok) {
      hasLoadedDataRef.current = true;
      setIsLoggedIn(true);
      if (setUser)
        setUser((prev) => ({
          ...(prev || {}),
          hasPassword: true,
          ent_username: entUsername,
        }));
    }
  };

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
        moduleData.epreves.forEach((epreuve) => {
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

  const handleGradeEdit = (moduleName, gradeIndex, newNote) => {
    setModifiedGrades((prev) => {
      const updated = { ...prev };
      if (newNote === null) {
        // Si null, supprimer la modification
        if (updated[moduleName]) {
          delete updated[moduleName][gradeIndex];
          // Supprimer le module si plus aucune note modifiée
          if (Object.keys(updated[moduleName]).length === 0) {
            delete updated[moduleName];
          }
        }
      } else {
        // Ajouter/modifier la note
        updated[moduleName] = {
          ...updated[moduleName],
          [gradeIndex]: parseFloat(newNote),
        };
      }
      return updated;
    });
  };

  const calculateAverage = (module, moduleName) => {
    // Repartir de zéro pour éviter d'ajouter plusieurs fois
    let basePoints = 0;
    let baseCoeff = 0;

    // Ajouter les épreuves du module
    module.epreuves.forEach((epreuve, index) => {
      const modifiedNote = modifiedGrades[moduleName]?.[index];
      const note =
        modifiedNote ?? (parseFloat(epreuve["Notes"].replace(",", ".")) || 0);
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

      {!isLoggedIn && !isLoading && (
        <div className="login-container">
          {user?.hasPassword && !showManualLogin ? (
            <div className="stored-login">
              <button
                className="big-button"
                onClick={handleFetchWithStoredPassword}
              >
                Afficher mes notes
              </button>
              <button
                className="link-button"
                onClick={() => setShowManualLogin(true)}
              >
                Me connecter avec un autre compte
              </button>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleSubmitCredentials}>
              <div className="input-group">
                <input type="hidden" value={userName} />
                <input
                  type="text"
                  placeholder="Identifiant ENT (ex: pnom)"
                  value={entUsername}
                  onChange={(e) => setEntUsername(e.target.value)}
                />
                <label>Identifiant ENT</label>
                <span className="input-line"></span>
              </div>
              <div className="input-group">
                <input
                  type="password"
                  placeholder="Mot de passe ENT"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <label>Mot de passe ENT</label>
                <span className="input-line"></span>
              </div>
              <div className="remember-me">
                <label>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  Se souvenir du mot de passe
                </label>
              </div>
              <div className="login-actions">
                <button type="submit" className="submit-button">
                  <span>Afficher mes notes</span>
                </button>
                {user?.hasPassword && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setShowManualLogin(false)}
                  >
                    Utiliser le mot de passe stocké
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

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

      {isLoggedIn && !isLoading && (
        <>
          {error && <p className="error">{error}</p>}
          {!error && (
            <div className="notes-frame">
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
                          <ModuleDisplay
                            key={moduleName}
                            moduleData={moduleData}
                            moduleName={moduleName}
                            isExpanded={isExpanded}
                            toggleModule={toggleModule}
                            average={average}
                            simulatedGrades={simulatedGrades}
                            updateSimulatedGrade={updateSimulatedGrade}
                            removeSimulatedGrade={removeSimulatedGrade}
                            addSimulatedGrade={addSimulatedGrade}
                            onGradeEdit={handleGradeEdit}
                          />
                        );
                      }
                    )
                  : // Affichage avec groupement UE
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
                                <ModuleDisplay
                                  key={moduleName}
                                  moduleData={moduleData}
                                  moduleName={moduleName}
                                  isExpanded={isExpanded}
                                  toggleModule={toggleModule}
                                  average={average}
                                  simulatedGrades={simulatedGrades}
                                  updateSimulatedGrade={updateSimulatedGrade}
                                  removeSimulatedGrade={removeSimulatedGrade}
                                  addSimulatedGrade={addSimulatedGrade}
                                  ueName={ueName}
                                  moduleCoef={moduleData.coef}
                                  onGradeEdit={handleGradeEdit}
                                />
                              );
                            }
                          )}
                        </div>
                      </div>
                    ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Notes;
