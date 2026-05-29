import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Loader2,
  MessageSquareText,
  PartyPopper,
  Pin,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const presentationClasses = {
  banner:
    "rounded-2xl border border-amber-200 bg-amber-50/95 shadow-lg",
  toast:
    "rounded-2xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur",
  modal:
    "rounded-3xl border border-gray-200 bg-white shadow-2xl",
  "bottom-sheet":
    "rounded-t-3xl border border-gray-200 bg-white shadow-2xl",
};

const toneClasses = {
  default: "border-gray-200 bg-gray-50 text-gray-700",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-900",
};

const titleIcons = {
  alert: Bell,
  announcement: PartyPopper,
  poll: ClipboardList,
  prompt: MessageSquareText,
  stack: Pin,
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 12, scale: 0.98 },
};

const formatLifecycle = (campaign) => {
  if (campaign.lifecycle_state === "planned") return "Planifiée";
  if (campaign.lifecycle_state === "expired") return "Expirée";
  if (campaign.status === "active") return "Active";
  if (campaign.status === "paused") return "En pause";
  if (campaign.status === "archived") return "Archivée";
  return "Brouillon";
};

const initialResponseState = (campaign) => {
  const next = {};
  (campaign.blocks || []).forEach((block) => {
    if (block.block_type === "poll") {
      next[block.id] = { selected_options: [] };
    }
    if (block.block_type === "textarea") {
      next[block.id] = { text: "" };
    }
  });
  return next;
};

const StatusBadge = ({ children }) => (
  <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary/8 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
    {children}
  </span>
);

const InteractiveBlock = ({
  block,
  response,
  onChange,
  disabled,
}) => {
  if (block.block_type === "poll") {
    const selectedOptions = response?.selected_options || [];
    const allowMultiple = Boolean(block.payload?.allow_multiple);

    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-secondary">
          {block.payload?.question}
        </p>
        <div className="space-y-2">
          {(block.payload?.options || []).map((option) => {
            const isSelected = selectedOptions.includes(option);
            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  if (allowMultiple) {
                    const nextOptions = isSelected
                      ? selectedOptions.filter((entry) => entry !== option)
                      : [...selectedOptions, option];
                    onChange({ selected_options: nextOptions });
                    return;
                  }
                  onChange({
                    selected_options: isSelected ? [] : [option],
                  });
                }}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/8 text-primary"
                    : "border-gray-200 bg-white text-gray-700 hover:border-primary/30"
                } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
              >
                <span>{option}</span>
                {isSelected && <CheckCircle2 className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (block.block_type === "textarea") {
    return (
      <label className="block">
        <span className="text-sm font-semibold text-secondary">
          {block.payload?.prompt}
        </span>
        <textarea
          className="mt-2 min-h-[120px] w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-800 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
          disabled={disabled}
          placeholder={block.payload?.placeholder || ""}
          maxLength={block.payload?.max_length || 600}
          value={response?.text || ""}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      </label>
    );
  }

  return null;
};

const ContentBlock = ({
  block,
  response,
  onResponseChange,
  disabled,
}) => {
  if (block.block_type === "text") {
    const tone = toneClasses[block.payload?.tone] || toneClasses.default;
    return (
      <div className={`rounded-2xl border px-4 py-3 text-sm whitespace-pre-wrap ${tone}`}>
        {block.payload?.text}
      </div>
    );
  }

  if (block.block_type === "cta") {
    const isGhost = block.payload?.style === "secondary";
    const href = block.payload?.href;
    const commonClass = `inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
      isGhost
        ? "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
        : "bg-primary text-white hover:bg-primary-dark"
    }`;

    if (href) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={commonClass}
        >
          {block.payload?.label}
          <ChevronRight className="h-4 w-4" />
        </a>
      );
    }

    return (
      <span className={commonClass}>
        {block.payload?.label}
      </span>
    );
  }

  if (block.block_type === "event-highlight") {
    return (
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4">
        <p className="text-sm font-semibold text-indigo-900">
          {block.payload?.title}
        </p>
        {block.payload?.description && (
          <p className="mt-2 text-sm whitespace-pre-wrap text-indigo-800">
            {block.payload.description}
          </p>
        )}
        {block.payload?.href && (
          <a
            href={block.payload.href}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:text-indigo-900"
          >
            {block.payload?.label || "En savoir plus"}
            <ChevronRight className="h-4 w-4" />
          </a>
        )}
      </div>
    );
  }

  return (
    <InteractiveBlock
      block={block}
      response={response}
      onChange={onResponseChange}
      disabled={disabled}
    />
  );
};

export const CampaignCard = ({
  campaign,
  mode = "embedded",
  responses,
  onResponseChange,
  onSubmit,
  onClose,
  onHideForever,
  submitting = false,
  statusMessage = "",
  preview = false,
}) => {
  const TitleIcon = titleIcons[campaign.type] || Bell;
  const presentationClass =
    presentationClasses[campaign.presentation] || presentationClasses.modal;
  const isSheet = campaign.presentation === "bottom-sheet";
  const canDismiss = campaign.dismiss_mode !== "persistent";
  const supportsHideForever = campaign.dismiss_mode === "hide-forever";
  const interactiveBlocks = (campaign.blocks || []).filter((block) =>
    ["poll", "textarea"].includes(block.block_type),
  );
  const needsResponse = campaign.response_mode === "required";
  const hasResponseContent = interactiveBlocks.some((block) => {
    const response = responses?.[block.id];
    if (block.block_type === "poll") {
      return (response?.selected_options || []).length > 0;
    }
    return Boolean(String(response?.text || "").trim());
  });

  return (
    <motion.section
      variants={panelVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`${presentationClass} ${isSheet ? "w-full rounded-b-none" : ""}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <TitleIcon className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-secondary">
                {campaign.title}
              </h3>
              {preview && <StatusBadge>{formatLifecycle(campaign)}</StatusBadge>}
            </div>
            {preview && (
              <p className="mt-1 text-xs text-gray-500">
                {campaign.presentation} · priorité {campaign.priority}
              </p>
            )}
          </div>
        </div>
        {canDismiss && (
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-4 px-5 py-4">
        {campaign.body && (
          <p className="text-sm whitespace-pre-wrap text-gray-700">{campaign.body}</p>
        )}
        {(campaign.blocks || []).map((block) => (
          <ContentBlock
            key={block.id || `${block.block_type}-${block.position}`}
            block={block}
            response={responses?.[block.id]}
            onResponseChange={(nextValue) => onResponseChange?.(block.id, nextValue)}
            disabled={submitting || preview}
          />
        ))}
        {statusMessage && (
          <div className="rounded-xl border border-primary/15 bg-primary/8 px-3 py-2 text-sm font-medium text-primary">
            {statusMessage}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-100 px-5 py-4">
        {interactiveBlocks.length > 0 && (
          <button
            type="button"
            disabled={preview || submitting || (needsResponse && !hasResponseContent)}
            onClick={onSubmit}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Envoyer ma réponse
          </button>
        )}
        <div className="flex flex-wrap gap-2">
          {supportsHideForever && (
            <button
              type="button"
              onClick={onHideForever}
              disabled={submitting || preview}
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              Ne plus voir
            </button>
          )}
          {canDismiss && (
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || preview}
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              {interactiveBlocks.length > 0 ? "Plus tard" : "Fermer"}
            </button>
          )}
        </div>
      </div>
    </motion.section>
  );
};

export const CampaignPreviewFrame = ({ campaign }) => {
  const [responses, setResponses] = useState(() => initialResponseState(campaign));

  useEffect(() => {
    setResponses(initialResponseState(campaign));
  }, [campaign]);

  return (
    <div className="rounded-[28px] border border-gray-200 bg-slate-100 p-3 shadow-inner">
      <div className="mx-auto max-w-sm rounded-[24px] border border-slate-200 bg-white p-3 shadow-lg">
        <div className="mb-3 flex items-center justify-center">
          <span className="h-1.5 w-14 rounded-full bg-slate-200" />
        </div>
        <CampaignCard
          campaign={campaign}
          preview
          responses={responses}
          onResponseChange={(blockId, nextValue) =>
            setResponses((prev) => ({ ...prev, [blockId]: nextValue }))
          }
          statusMessage="Aperçu mobile"
        />
      </div>
    </div>
  );
};

const toastOffsets = (index) => ({
  bottom: 24 + index * 96,
});

export const CampaignSurfaces = ({
  campaigns,
  responseStateByCampaign,
  onResponseChange,
  onSubmit,
  onDismiss,
  onHideForever,
  submittingId,
  statusMessages,
}) => {
  const grouped = useMemo(
    () => ({
      banners: campaigns.filter((campaign) => campaign.presentation === "banner"),
      toasts: campaigns.filter((campaign) => campaign.presentation === "toast"),
      overlays: campaigns.filter((campaign) =>
        ["modal", "bottom-sheet"].includes(campaign.presentation),
      ),
    }),
    [campaigns],
  );

  const [overlayIndex, setOverlayIndex] = useState(0);

  useEffect(() => {
    setOverlayIndex(0);
  }, [grouped.overlays.length]);

  const currentOverlay = grouped.overlays[overlayIndex] || null;

  return (
    <>
      {grouped.banners.length > 0 && (
        <div className="space-y-3 px-4 pb-2 pt-3">
          {grouped.banners.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              mode="banner"
              responses={responseStateByCampaign[campaign.id]}
              onResponseChange={(blockId, nextValue) =>
                onResponseChange(campaign.id, blockId, nextValue)
              }
              onSubmit={() => onSubmit(campaign)}
              onClose={() => onDismiss(campaign)}
              onHideForever={() => onHideForever(campaign)}
              submitting={submittingId === campaign.id}
              statusMessage={statusMessages[campaign.id] || ""}
            />
          ))}
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[85] flex flex-col items-center gap-3 px-4 pb-4">
        <AnimatePresence>
          {grouped.toasts.map((campaign, index) => (
            <motion.div
              key={campaign.id}
              style={toastOffsets(index)}
              className="pointer-events-auto w-full max-w-sm"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <CampaignCard
                campaign={campaign}
                responses={responseStateByCampaign[campaign.id]}
                onResponseChange={(blockId, nextValue) =>
                  onResponseChange(campaign.id, blockId, nextValue)
                }
                onSubmit={() => onSubmit(campaign)}
                onClose={() => onDismiss(campaign)}
                onHideForever={() => onHideForever(campaign)}
                submitting={submittingId === campaign.id}
                statusMessage={statusMessages[campaign.id] || ""}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {currentOverlay && (
          <motion.div
            className={`fixed inset-0 z-[90] flex px-4 pt-10 ${
              currentOverlay.presentation === "bottom-sheet"
                ? "items-end"
                : "items-center justify-center"
            } bg-black/35`}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <div
              className={`w-full ${
                currentOverlay.presentation === "bottom-sheet"
                  ? "max-w-none"
                  : "max-w-xl"
              }`}
            >
              <CampaignCard
                campaign={currentOverlay}
                mode="overlay"
                responses={responseStateByCampaign[currentOverlay.id]}
                onResponseChange={(blockId, nextValue) =>
                  onResponseChange(currentOverlay.id, blockId, nextValue)
                }
                onSubmit={() => onSubmit(currentOverlay)}
                onClose={() => {
                  onDismiss(currentOverlay);
                  setOverlayIndex((prev) => prev + 1);
                }}
                onHideForever={() => {
                  onHideForever(currentOverlay);
                  setOverlayIndex((prev) => prev + 1);
                }}
                submitting={submittingId === currentOverlay.id}
                statusMessage={statusMessages[currentOverlay.id] || ""}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
