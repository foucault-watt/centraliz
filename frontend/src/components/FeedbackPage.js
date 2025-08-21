import { MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import PageLayout from "./PageLayout";

const FeedbackPage = () => {
  const [feedback, setFeedback] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");

  const sanitizeFeedback = (text) => {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();

    const sanitizedFeedback = sanitizeFeedback(feedback);
    setSubmitStatus("Envoi en cours...");

    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_BACK}/api/feedback`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: sanitizedFeedback,
          }),
        }
      );

      if (response.ok) {
        setSubmitStatus("Merci pour votre feedback!");
        setFeedback("");
        setTimeout(() => {
          setSubmitStatus("");
        }, 3000);
      } else {
        throw new Error("Réponse serveur non valide");
      }
    } catch (error) {
      console.error("Erreur:", error);
      setSubmitStatus("Une erreur est survenue");
      setTimeout(() => setSubmitStatus(""), 3000);
    }
  };

  return (
    <PageLayout>
      <div className="p-4 border text-secondary bg-background-module shadow-xl rounded-2xl">
        <h2 className="text-2xl font-bold mb-4 flex items-center">
          <MessageCircle className="mr-2" size={24} /> Feedback
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Vous pouvez laisser vos feedbacks ici pour m'aider à améliorer l'application et partager vos avis.
        </p>
        <form onSubmit={handleFeedbackSubmit} className="space-y-4">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleFeedbackSubmit(e);
              }
            }}
            placeholder="Partagez vos suggestions..."
            required
            maxLength={800}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="6"
          />
          <button
            type="submit"
            className="flex items-center justify-center px-4 py-2 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Send size={14} className="mr-2" />
            <span>Envoyer</span>
          </button>
          {submitStatus && (
            <div className="mt-4 p-3 rounded-lg bg-blue-100 text-blue-800 text-center">
              {submitStatus}
            </div>
          )}
        </form>
      </div>
    </PageLayout>
  );
};

export default FeedbackPage;
