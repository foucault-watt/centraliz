import axios from "axios";
import { Upload } from "lucide-react";
import Papa from "papaparse";
import React, { useCallback, useEffect, useState, useContext } from "react";
import { UserContext } from "../App";

const Notes = () => {
  const [modules, setModules] = useState({});
  const [expandedModules, setExpandedModules] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCSVUploaded, setIsCSVUploaded] = useState(false);
  const [error, setError] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { userName } = useContext(UserContext);
  const [coefficients, setCoefficients] = useState(null);
  const [organizedModules, setOrganizedModules] = useState({});
  const [userGroup, setUserGroup] = useState(null);  // Ajouter cet état
  const [activeUE, setActiveUE] = useState(null);
  const [unlistedModules, setUnlistedModules] = useState([]);

  const fetchCSVData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const downloadResponse = await axios.post("/api/download-csv", {
        username,
        password,
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
  }, [username, password]);

  useEffect(() => {
    if (isLoggedIn && !isCSVUploaded) {
      fetchCSVData();
    }
  }, [isLoggedIn, isCSVUploaded, fetchCSVData]);

  useEffect(() => {
    const fetchCoefficients = async () => {
      try {
        const response = await axios.get(`/api/coef/${userName}`);
        setCoefficients(response.data);
        // Récupérer le groupe depuis la réponse
        const userGroupFromResponse = Object.keys(response.data.groups)[0];
        setUserGroup(userGroupFromResponse);
      } catch (error) {
        console.error("Erreur lors de la récupération des coefficients:", error);
      }
    };

    if (userName) {
      fetchCoefficients();
    }
  }, [userName]);

  const processGrades = (grades) => {
    if (!coefficients || !userGroup) {
      // Si pas de coefficients pour le groupe, traiter tous les modules sans UE
      const processedModules = {};
      const unmatched = [];
      
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
        // ...existing grade processing code...
      });

      setModules(processedModules);
      setOrganizedModules({
        "Tous les modules": {
          coef: 1,
          modules: processedModules,
          moyenne: 0
        }
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
    coefficients.groups[userGroup].UE.forEach(ueObj => {
      const ueName = Object.keys(ueObj)[0];
      const ueData = ueObj[ueName][0];
      
      organizedByUE[ueName] = {
        coef: ueData.coef,
        modules: {},
        moyenne: 0,
        totalPoints: 0,
        totalCoeff: 0
      };

      Object.entries(ueData.enseignements[0]).forEach(([moduleName, moduleCoef]) => {
        moduleFound.add(moduleName);
        if (processedModules[moduleName]) {
          const moduleData = processedModules[moduleName];
          organizedByUE[ueName].modules[moduleName] = {
            ...moduleData,
            coef: moduleCoef
          };
          
          if (moduleData.totalCoeff > 0) {
            const moduleMoyenne = moduleData.totalPoints / moduleData.totalCoeff;
            organizedByUE[ueName].totalPoints += moduleMoyenne * moduleCoef;
            organizedByUE[ueName].totalCoeff += moduleCoef;
          }
        }
      });

      if (organizedByUE[ueName].totalCoeff > 0) {
        organizedByUE[ueName].moyenne = 
          organizedByUE[ueName].totalPoints / organizedByUE[ueName].totalCoeff;
      }
    });

    // Identifier les modules non listés
    Object.keys(processedModules).forEach(moduleName => {
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
          Array.from(unmatched).map(name => [
            name,
            { ...processedModules[name], coef: 1 }
          ])
        ),
        moyenne: 0
      };
    }

    setModules(processedModules);
    setOrganizedModules(organizedByUE);
    setExpandedModules(
      Object.keys(processedModules).reduce((acc, moduleName) => {
        acc[moduleName] = false;
        return acc;
      }, {})
    );
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];

    if (file && file.type === "text/csv") {
      const reader = new FileReader();

      reader.onload = (e) => {
        const csvData = e.target.result;

        Papa.parse(csvData, {
          header: true,
          complete: (results) => {
            processGrades(results.data);
            setIsCSVUploaded(true);
            setIsLoggedIn(true);
            setIsLoading(false);
          },
          error: () => {
            setError(
              "CSV invalide. Veuillez vérifier le fichier et réessayer."
            );
          },
        });
      };

      reader.readAsText(file);
    } else {
      setError("Veuillez sélectionner un fichier CSV valide.");
    }
  };

  const calculateAverage = (module) => {
    const { totalPoints, totalCoeff, vCount, nvCount } = module;
    const hasNumericNotes = totalCoeff > 0;
    const onlyV = vCount > 0 && nvCount === 0 && !hasNumericNotes;
    const hasNV = nvCount > 0;

    if (hasNumericNotes) {
      const average = (totalPoints / totalCoeff).toFixed(2);
      return {
        value: average,
        class: average >= 10 ? "vert" : average >= 7 ? "orange" : "rouge",
      };
    } else if (hasNV) {
      return { value: "Non Validé", class: "rouge" };
    } else if (onlyV) {
      return { value: "Validé", class: "vert" };
    } else {
      return { value: "N/A", class: "" };
    }
  };

  const toggleModule = (moduleName, ueName) => {
    setExpandedModules((prev) => {
      // Si on clique sur un module d'une nouvelle UE, on ferme tous les modules
      if (activeUE !== ueName) {
        const allClosed = Object.keys(prev).reduce((acc, key) => {
          acc[key] = false;
          return acc;
        }, {});
        
        // On ouvre tous les modules de la nouvelle UE
        const updatedModules = { ...allClosed };
        Object.entries(organizedModules[ueName].modules).forEach(([name]) => {
          updatedModules[name] = true;
        });
        
        setActiveUE(ueName);
        return updatedModules;
      }
      
      // Si on clique sur un module de l'UE active et que tous les modules sont ouverts
      // On ferme tous les modules et on désactive l'UE
      const allUEModulesOpen = Object.entries(organizedModules[ueName].modules)
        .every(([name]) => prev[name]);
      
      if (allUEModulesOpen) {
        const allClosed = Object.keys(prev).reduce((acc, key) => {
          acc[key] = false;
          return acc;
        }, {});
        setActiveUE(null);
        return allClosed;
      }
      
      // Sinon, on ouvre tous les modules de l'UE
      const updatedModules = { ...prev };
      Object.entries(organizedModules[ueName].modules).forEach(([name]) => {
        updatedModules[name] = true;
      });
      return updatedModules;
    });
  };

  const handleLogin = (event) => {
    event.preventDefault();
    if (username && password) {
      setIsLoggedIn(true);
    } else {
      alert("Veuillez entrer un nom d'utilisateur et un mot de passe.");
    }
  };

  const getAverageClass = (average) => {
    return average >= 10 ? "vert" : average >= 7 ? "orange" : "rouge";
  };

  return (
    <div className="container">
      {!isLoggedIn && (
        <>
          <h2 className="module-title">Calcul des notes</h2>
          <div className="info-message">
            🚧 Cette fonctionnalité est en cours de développement. L'importation
            manuelle du CSV est temporaire, bientôt les notes seront
            synchronisées automatiquement avec WebAurion ! 🚀
          </div>
          <div className="upload-section">
            <label className="upload-button">
              <Upload className="upload-icon" />
              Importer un CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </label>
          </div>
          <span className="upload-message">
            Sur WebAurion, allez dans "Notes" → "Exporter" → "CSV en UTF-8" et
            importez le ici
          </span>
          <a
            href="https://webaurion.centralelille.fr/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <video
              src={process.env.PUBLIC_URL + "/export-webaurion.mp4"}
              className="tuto-export-webaurion"
              autoPlay
              loop
              muted
              playsInline
            />
          </a>
          <form
            className="login-form"
            onSubmit={handleLogin}
            style={{ display: "none" }}
          >
            <input
              type="text"
              placeholder="Nom d'utilisateur ENT"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Mot de passe ENT"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">Se connecter</button>
          </form>
        </>
      )}

      {(isLoggedIn || isCSVUploaded) && (
        <>
          {isLoading && (
            <div className="loadingo-container">
              <p className="loadingo-text">
                Sers-toi un café, on bombarde WebAurion pour toi...
              </p>
              <div className="bomb-container">
                <div className="bomb">💣</div>
                <div className="bomb">💣</div>
                <div className="bomb">💣</div>
              </div>
              <div className="explosion">💥</div>
            </div>
          )}
          {error && <p className="error">{error}</p>}
          {!isLoading && !error && (
            <>
              {unlistedModules.length > 0 && (
                <div className="warning-message">
                  ⚠️ Certains modules ne sont pas correctement référencés dans notre base de données : 
                  {unlistedModules.join(", ")}
                  <br />
                  <span className="feedback-hint">
                    N'hésitez pas à nous signaler ce problème via le menu "Feedback" dans l'en-tête pour nous aider à l'améliorer !
                  </span>
                </div>
              )}
              <div className="grid">
                {Object.entries(organizedModules).map(([ueName, ueData]) => (
                  <div key={ueName} className="ue-section">
                    <h2 className="ue-title">
                      {ueName} 
                      {ueData.moyenne > 0 && (
                        <span className={`moyenne ${getAverageClass(ueData.moyenne)}`}>
                          {ueData.moyenne.toFixed(2)}
                        </span>
                      )}
                    </h2>
                    <div className="modules-grid">
                      {Object.entries(ueData.modules).map(([moduleName, moduleData]) => {
                        const average = calculateAverage(moduleData);
                        const isExpanded = expandedModules[moduleName];
                        return (
                          <div key={moduleName} className="module">
                            <div className={`module-header ${isExpanded ? "expanded" : ""}`}
                                 onClick={() => toggleModule(moduleName, ueName)}>
                              <h3>{moduleName}</h3>
                              <div className="header-right">
                                <span className="coef">Coef {moduleData.coef}</span>
                                <span className={`moyenne ${average.class}`}>
                                  {average.value}
                                </span>
                              </div>
                            </div>
                            <div className={`module-content ${isExpanded ? "expanded" : ""}`}>
                              {moduleData.epreuves.map((epreuve, index) => (
                                <div key={index} className="epreuve">
                                  <h3>{epreuve["Épreuve"].split("- ").pop()}</h3>
                                  <p>{epreuve["Type de contrôle"]}</p>
                                  <p>{epreuve["Début"]}</p>
                                  <p>
                                    Coeff{" "}
                                    {epreuve["Coefficient de l'Épreuve dans le Module"]}{" "}
                                    - <b>{epreuve["Notes"]}</b>
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
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
