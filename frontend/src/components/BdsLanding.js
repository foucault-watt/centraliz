import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSupportBdsInfo, SUPPORT_BDS_MAP } from "../config/supportBds";
import { fetchApi } from "../utils/api";

const BdsLanding = () => {
  const { supportKey } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading, success, error
  const [bdsInfo, setBdsInfo] = useState(null);

  useEffect(() => {
    const normalizedKey = supportKey?.toLowerCase().trim();
    const isValidKey =
      normalizedKey && SUPPORT_BDS_MAP.hasOwnProperty(normalizedKey);
    const info = getSupportBdsInfo(supportKey);
    setBdsInfo(info);

    const trackSupport = async () => {
      try {
        const response = await fetchApi("/api/bds/track", {
          method: "POST",
          body: JSON.stringify({ supportKey }),
        });
        const data = await response.json();

        if (data.success) {
          setStatus("success");
          // Wait a bit then redirect
          setTimeout(() => {
            window.location.href = "/";
          }, 2500);
        } else {
          setStatus("error");
          setTimeout(() => {
            window.location.href = "/";
          }, 2500);
        }
      } catch (error) {
        console.error("Error tracking BDS support", error);
        setStatus("error");
        setTimeout(() => {
          window.location.href = "/";
        }, 2500);
      }
    };

    if (isValidKey) {
      trackSupport();
    } else {
      setStatus("error"); // Invalid key
      setTimeout(() => {
        window.location.href = "/";
      }, 2500);
    }
  }, [supportKey]); // Removed navigate dependency

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 p-8 rounded-xl shadow-2xl max-w-md w-full text-center border border-slate-700"
      >
        {status === "loading" && (
          <>
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold mb-2">Connexion au support...</h2>
            {bdsInfo && (
              <p className="text-slate-400">
                Association avec {bdsInfo.displayName}
              </p>
            )}
          </>
        )}

        {status === "success" && bdsInfo && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </motion.div>
            <h2 className="text-2xl font-bold mb-2 text-green-400">
              C'est noté !
            </h2>
            <p className="text-slate-300 mb-4">
              Tu soutiens maintenant{" "}
              <span
                className="font-bold text-white"
                style={{ color: bdsInfo.accentColor }}
              >
                {bdsInfo.displayName}
              </span>
              .
            </p>
            <p className="text-sm text-slate-500">Redirection en cours...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2 text-red-400">Oups...</h2>
            <p className="text-slate-400 mb-4">Lien invalide ou expiré.</p>
            <p className="text-sm text-slate-500">Retour à l'accueil...</p>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default BdsLanding;
