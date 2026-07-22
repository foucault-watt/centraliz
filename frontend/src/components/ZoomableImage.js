import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const transformSupabaseImageUrl = (src, width, quality) => {
  if (!src || !src.includes("/storage/v1/object/public/")) {
    return src;
  }

  const transformed = src.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/",
  );

  const separator = transformed.includes("?") ? "&" : "?";
  return `${transformed}${separator}width=${width}&quality=${quality}`;
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
  },
};

const panelVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.985, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.99,
    filter: "blur(2px)",
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
  },
};

const imageVariants = {
  hidden: { opacity: 0, scale: 1.01 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.04 },
  },
  exit: {
    opacity: 0,
    scale: 0.995,
    transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
  },
};

const ZoomableImage = ({ src, alt, className = "", previewClassName = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const previewSrc = useMemo(
    () => transformSupabaseImageUrl(src, 900, 65),
    [src],
  );
  const hdSrc = useMemo(
    () => transformSupabaseImageUrl(src, 1800, 95) || src,
    [src],
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
      if (event.key === "+" || event.key === "=") {
        setZoom((current) => Math.min(current + 0.25, 4));
      }
      if (event.key === "-") {
        setZoom((current) => Math.max(current - 0.25, 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setZoom(1);
    }
  }, [isOpen]);

  const openViewer = () => {
    if (!src) return;
    setIsOpen(true);
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 0.12 : -0.12;
    setZoom((current) => Math.min(4, Math.max(1, current + direction)));
  };

  return (
    <>
      <button
        type="button"
        onClick={openViewer}
        className={`block w-full overflow-hidden bg-transparent ${className}`}
      >
        <img
          src={previewSrc}
          alt={alt}
          loading="lazy"
          className={`w-full h-full object-contain rounded-2xl transition-transform duration-300 hover:scale-[1.02] ${previewClassName}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              className="relative w-full h-full max-w-6xl max-h-[92vh] flex flex-col"
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 mb-3 text-white">
                <div className="text-sm md:text-base font-semibold truncate">
                  {alt}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setZoom((current) => Math.max(1, current - 0.25))
                    }
                    className="rounded-full bg-white/10 hover:bg-white/20 p-2 transition-colors"
                    aria-label="Dézoomer"
                  >
                    <Minus size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setZoom((current) => Math.min(4, current + 0.25))
                    }
                    className="rounded-full bg-white/10 hover:bg-white/20 p-2 transition-colors"
                    aria-label="Zoomer"
                  >
                    <Plus size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom(1)}
                    className="rounded-full bg-white/10 hover:bg-white/20 p-2 transition-colors"
                    aria-label="Réinitialiser le zoom"
                  >
                    <RotateCcw size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="rounded-full bg-white/10 hover:bg-white/20 p-2 transition-colors"
                    aria-label="Fermer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div
                className="flex-1 overflow-hidden flex items-center justify-center p-2 md:p-4"
                onWheel={handleWheel}
              >
                <motion.img
                  src={hdSrc}
                  alt={alt}
                  className="max-w-none max-h-full select-none rounded-2xl"
                  variants={imageVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "center center",
                  }}
                  draggable="false"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ZoomableImage;
