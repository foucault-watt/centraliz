import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchApi } from "../utils/api";
import { CampaignSurfaces } from "./CampaignSurface";

const buildInitialResponses = (campaigns) => {
  const next = {};
  campaigns.forEach((campaign) => {
    next[campaign.id] = {};
    (campaign.blocks || []).forEach((block) => {
      if (block.block_type === "poll") {
        next[campaign.id][block.id] = { selected_options: [] };
      }
      if (block.block_type === "textarea") {
        next[campaign.id][block.id] = { text: "" };
      }
    });
  });
  return next;
};

const CampaignRuntime = () => {
  const location = useLocation();
  const [campaigns, setCampaigns] = useState([]);
  const [responsesByCampaign, setResponsesByCampaign] = useState({});
  const [submittingId, setSubmittingId] = useState("");
  const [statusMessages, setStatusMessages] = useState({});

  const loadCampaigns = useCallback(async () => {
    try {
      const response = await fetchApi(
        `/api/campaigns/active?page=${encodeURIComponent(location.pathname)}`,
      );
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setCampaigns([]);
        return;
      }

      const nextCampaigns = payload.campaigns || [];
      setCampaigns(nextCampaigns);
      setResponsesByCampaign((prev) => ({
        ...buildInitialResponses(nextCampaigns),
        ...prev,
      }));
    } catch (error) {
      console.error("[CampaignRuntime] Impossible de charger les campagnes:", error);
      setCampaigns([]);
    }
  }, [location.pathname]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    campaigns.forEach((campaign) => {
      fetchApi(`/api/campaigns/${campaign.id}/impression`, {
        method: "POST",
        body: JSON.stringify({}),
      }).catch(() => null);
    });
  }, [campaigns]);

  const handleResponseChange = useCallback((campaignId, blockId, nextValue) => {
    setResponsesByCampaign((prev) => ({
      ...prev,
      [campaignId]: {
        ...(prev[campaignId] || {}),
        [blockId]: nextValue,
      },
    }));
  }, []);

  const setStatus = useCallback((campaignId, message) => {
    setStatusMessages((prev) => ({ ...prev, [campaignId]: message }));
    if (message) {
      window.setTimeout(() => {
        setStatusMessages((prev) => ({ ...prev, [campaignId]: "" }));
      }, 3000);
    }
  }, []);

  const removeCampaign = useCallback((campaignId) => {
    setCampaigns((prev) => prev.filter((campaign) => campaign.id !== campaignId));
  }, []);

  const handleDismiss = useCallback(
    async (campaign) => {
      try {
        await fetchApi(`/api/campaigns/${campaign.id}/dismiss`, {
          method: "POST",
          body: JSON.stringify({ hide_forever: false }),
        });
      } catch (error) {
        console.warn("[CampaignRuntime] dismiss ignoré:", error);
      } finally {
        removeCampaign(campaign.id);
      }
    },
    [removeCampaign],
  );

  const handleHideForever = useCallback(
    async (campaign) => {
      try {
        await fetchApi(`/api/campaigns/${campaign.id}/dismiss`, {
          method: "POST",
          body: JSON.stringify({ hide_forever: true }),
        });
      } catch (error) {
        console.warn("[CampaignRuntime] hide_forever ignoré:", error);
      } finally {
        removeCampaign(campaign.id);
      }
    },
    [removeCampaign],
  );

  const handleSubmit = useCallback(
    async (campaign) => {
      const campaignResponses = responsesByCampaign[campaign.id] || {};
      const payloadResponses = Object.entries(campaignResponses)
        .map(([blockId, response]) => ({
          block_id: blockId,
          ...response,
        }))
        .filter((entry) => {
          if (Array.isArray(entry.selected_options)) {
            return entry.selected_options.length > 0;
          }
          return Boolean(String(entry.text || "").trim());
        });

      if (!payloadResponses.length) {
        setStatus(campaign.id, "Ajoute au moins une réponse avant d'envoyer.");
        return;
      }

      setSubmittingId(campaign.id);
      try {
        const response = await fetchApi(`/api/campaigns/${campaign.id}/respond`, {
          method: "POST",
          body: JSON.stringify({ responses: payloadResponses }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Impossible d'envoyer la réponse.");
        }
        setStatus(campaign.id, "Réponse enregistrée.");
        removeCampaign(campaign.id);
      } catch (error) {
        setStatus(campaign.id, error.message || "Impossible d'envoyer la réponse.");
      } finally {
        setSubmittingId("");
      }
    },
    [removeCampaign, responsesByCampaign, setStatus],
  );

  const visibleCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => a.priority - b.priority),
    [campaigns],
  );

  if (!visibleCampaigns.length) {
    return null;
  }

  return (
    <CampaignSurfaces
      campaigns={visibleCampaigns}
      responseStateByCampaign={responsesByCampaign}
      onResponseChange={handleResponseChange}
      onSubmit={handleSubmit}
      onDismiss={handleDismiss}
      onHideForever={handleHideForever}
      submittingId={submittingId}
      statusMessages={statusMessages}
    />
  );
};

export default CampaignRuntime;
