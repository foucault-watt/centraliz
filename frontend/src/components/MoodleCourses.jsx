import { useState } from "react";
import { Link } from "react-router-dom";
import { fetchApi } from "../utils/api";
import LoadingSkeleton from "./LoadingSkeleton";
import PageHeader from "./PageHeader";
import { BookOpen as PageIcon } from "lucide-react";

const MoodleCourses = () => {
  const [courses, setCourses] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [sections, setSections] = useState(null);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionsError, setSectionsError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const downloadOriginal = async resource => {
    setDownloading(true);
    setSectionsError(null);
    try {
      const courseId = new URL(selectedCourse.url).searchParams.get("id");
      const response = await fetchApi(`/api/moodle/courses/${courseId}/resources/${resource.moduleId}/file`, { method: "POST" });
      if (!response.ok) {
        const data = await response.json();
        setSectionsError(data.error || "Impossible de récupérer ce fichier.");
        return;
      }
      const disposition = response.headers.get("Content-Disposition") || "";
      const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const name = encodedName ? decodeURIComponent(encodedName) : "document";
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setSectionsError("Impossible de télécharger ce fichier. Réessaie dans un instant.");
    } finally { setDownloading(false); }
  };

  const loadSections = async (course) => {
    const courseId = new URL(course.url).searchParams.get("id");
    setSelectedCourse(course);
    setSections(null);
    setSectionsError(null);
    setSectionsLoading(true);
    try {
      const response = await fetchApi(`/api/moodle/courses/${courseId}/sections`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setSectionsError(data.error || "Impossible de charger les ressources de ce cours.");
        return;
      }
      setSections(data.sections);
    } catch {
      setSectionsError("Impossible de joindre Centraliz. Réessaie dans un instant.");
    } finally {
      setSectionsLoading(false);
    }
  };

  const loadCourses = async () => {
    setLoading(true);
    setError(null);
    setSelectedCourse(null);
    setSections(null);
    try {
      const response = await fetchApi("/api/moodle/courses", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError({ message: data.error || "Impossible de charger tes cours.", action: data.action });
        return;
      }
      setCourses(data.courses);
    } catch {
      setError({ message: "Impossible de joindre Centraliz. Réessaie dans un instant." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-5">
      <PageHeader
        icon={PageIcon}
        title="Mes cours Moodle"
      />
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
        <button type="button" onClick={loadCourses} disabled={loading || sectionsLoading || downloading}
          className="rounded-xl bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50">
          {loading ? "Chargement des cours…" : courses ? "Actualiser mes cours" : "Afficher mes cours"}
        </button>
        {error && <div role="alert" className="mt-4 text-sm text-red-700">
          <p>{error.message}</p>
          {error.action === "prompt_ent_password" && <Link className="underline" to="/communication">Configurer mon compte ENT dans Mails</Link>}
          {["relogin_sso", "retry_with_local_key"].includes(error.action) &&
            <p>Reconnecte-toi à Centraliz pour renouveler ta clé de connexion.</p>}
        </div>}
      </div>
      {loading && <LoadingSkeleton label="Connexion à Moodle… ça peut prendre une minute." rows={3} />}
      {courses && !loading && <ul className="space-y-3" aria-label="Cours Moodle">
        {courses.map(course => <li key={course.url} className="bg-white rounded-xl p-4 border border-gray-200">
          <a href={course.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">{course.name}</a>
          <button type="button" onClick={() => loadSections(course)} disabled={sectionsLoading || loading || downloading}
            aria-label={`Voir les ressources de ${course.name}`}
            className="mt-3 block rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold disabled:opacity-50">
            Voir les ressources
          </button>
        </li>)}
      </ul>}
      {selectedCourse && <section className="space-y-4" aria-label={`Ressources de ${selectedCourse.name}`}>
        <h2 className="text-xl font-bold text-secondary">{selectedCourse.name}</h2>
        {sectionsLoading && <LoadingSkeleton label="Chargement des sections et ressources…" rows={3} />}
        {downloading && <p role="status">Récupération du fichier original…</p>}
        {sectionsError && <p role="alert" className="text-red-700">{sectionsError}</p>}
        {sections && sections.length === 0 && <p>Aucune section disponible dans ce cours.</p>}
        {sections && sections.map(section => <article key={section.id} className="bg-white rounded-xl p-4 border border-gray-200">
          <h3 className="text-lg font-semibold">{section.name}</h3>
          {section.resources.length === 0 ? <p className="mt-2 text-sm text-gray-600">Aucune ressource listée dans cette section.</p>
            : <ul className="mt-3 space-y-3">{section.resources.map((resource, index) => <li key={resource.id || index}>
                {resource.url ? <a href={resource.url} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline">{resource.name}</a> : <span>{resource.name}</span>}
                <span className="ml-2 text-xs text-gray-500">{resource.type}{!resource.available && " · Accès indisponible"}</span>
                {resource.available && resource.type === "resource" && resource.moduleId &&
                  <button type="button" disabled={downloading} onClick={() => downloadOriginal(resource)}
                    aria-label={`Télécharger ${resource.name}`}
                    className="ml-3 text-sm font-semibold text-primary underline disabled:opacity-50">Télécharger</button>}
              </li>)}</ul>}
        </article>)}
      </section>}
    </section>
  );
};

export default MoodleCourses;
