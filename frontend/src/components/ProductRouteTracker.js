import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getRouteAnalytics, trackProductEvent } from "../utils/analytics";

const ProductRouteTracker = () => {
  const location = useLocation();

  useEffect(() => {
    const route = getRouteAnalytics(location.pathname);
    if (!route) return;

    trackProductEvent("module_viewed", route.module, {
      route: route.route,
    });
  }, [location.pathname]);

  return null;
};

export default ProductRouteTracker;
