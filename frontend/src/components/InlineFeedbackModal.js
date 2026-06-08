import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchApi } from "../utils/api";

const MAX_FEEDBACK_LENGTH = 1000;

const InlineFeedbackModal = ({
  isOpen,
  onClose,
  title = "Envoyer un feedback",
  description = "Ajoute quelques details si tu veux, le message est deja prepare.",
  type = "bug",
  area = "general",
  priority = "normal",
  prefill = "",
}) => {
  const [text, setText] = useState(prefill);
  const [wantsResponse, setWantsResponse] = useState(true);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setText(prefill);
      setStatus("");
      setIsSubmitting(false);
    }
  }, [isOpen, prefill]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedText = text.trim();

    if (!trimmedText) {
      setStatus("Ajoute au moins une phrase avant d'envoyer.");
      return;
    }

    setIsSubmitting(true);
    setStatus("");

    try {
      const response = await fetchApi("/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          type,
          area,
          priority,
          text: trimmedText.slice(0, MAX_FEEDBACK_LENGTH),
          wants_response: wantsResponse,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Impossible d'envoyer le feedback");
      }

      setStatus("Merci, ton feedback est envoye.");
      setTimeout(() => {
        onClose?.();
      }, 850);
    } catch (error) {
      setStatus(error.message || "Impossible d'envoyer le feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 px-4 pb-4 pt-10 sm:items-center sm:pb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 22, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
              <div className="flex gap-3">
                <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {title}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">{description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">
                  Message
                </span>
                <textarea
                  className="mt-2 min-h-[190px] w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
                  value={text}
                  maxLength={MAX_FEEDBACK_LENGTH}
                  onChange={(event) => setText(event.target.value)}
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                  <input
                    type="checkbox"
                    checked={wantsResponse}
                    onChange={(event) => setWantsResponse(event.target.checked)}
                  />
                  Je veux une reponse si besoin
                </label>
                <span className="text-xs text-gray-400">
                  {text.length}/{MAX_FEEDBACK_LENGTH}
                </span>
              </div>

              {status && (
                <div className="inline-flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600">
                  {status.includes("envoye") && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                  {status}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Envoyer
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InlineFeedbackModal;
