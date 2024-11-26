import axios from "axios";
import { Upload } from "lucide-react";
import Papa from "papaparse";
import React, { useCallback, useEffect, useState } from "react";

const Notes = () => {
  const [modules, setModules] = useState({});
  const [expandedModules, setExpandedModules] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCSVUploaded, setIsCSVUploaded] = useState(false);
  const [error, setError] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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

  const processGrades = (grades) => {
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

    setModules(processedModules);
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

  const toggleModule = (moduleName) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleName]: !prev[moduleName],
    }));
  };

  const handleLogin = (event) => {
    event.preventDefault();
    if (username && password) {
      setIsLoggedIn(true);
    } else {
      alert("Veuillez entrer un nom d'utilisateur et un mot de passe.");
    }
  };

  return (
    <div className="container">
      {!isLoggedIn && (
        <>
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
            WebAurion : Exporter vos notes CSV en UTF-8
          </span>
          <a href="https://webaurion.centralelille.fr/" target="_blank" rel="noopener noreferrer">
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
            <div className="grid">
              {Object.entries(modules).map(([moduleName, moduleData]) => {
                const average = calculateAverage(moduleData);
                const isExpanded = expandedModules[moduleName];
                return (
                  <div key={moduleName} className="module">
                    <div
                      className={`module-header ${
                        isExpanded ? "expanded" : ""
                      }`}
                      onClick={() => toggleModule(moduleName)}
                    >
                      <h2>{moduleName}</h2>
                      <div className={`moyenne ${average.class}`}>
                        {average.value}
                      </div>
                    </div>
                    <div
                      className={`module-content ${
                        isExpanded ? "expanded" : ""
                      }`}
                    >
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
          )}
        </>
      )}
    </div>
  );
};

export default Notes;
