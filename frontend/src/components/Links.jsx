import React from "react";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { links } from "../data/links";
import { trackProductEvent } from "../utils/analytics";
import PageHeader from "./PageHeader";
import { ExternalLink as PageIcon } from "lucide-react";

const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: "easeOut", staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
};

const cardClassName =
  "bg-white rounded-2xl p-5 md:p-6 shadow-md border border-gray-200";

const trackClick = (service, category) => () =>
  trackProductEvent("external_link_clicked", "links", {
    name: service.name,
    category,
  });

const PrimaryLink = ({ service }) => (
  <a
    href={service.link}
    target="_blank"
    rel="noreferrer"
    onClick={trackClick(service, "primary")}
    className="group flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 no-underline transition-all hover:border-primary hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:p-4"
  >
    <img
      src={service.image}
      alt=""
      className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-gray-200 md:h-12 md:w-12"
    />
    <span className="min-w-0 flex-1">
      <span className="block truncate font-bold text-secondary">
        {service.name}
      </span>
      <span className="block truncate text-xs text-gray-500 md:text-sm">
        {service.description}
      </span>
    </span>
    <ArrowUpRight
      size={18}
      className="hidden shrink-0 text-gray-300 transition-colors group-hover:text-primary sm:block"
    />
  </a>
);

// Une tuile façon icône d'application : le logo porte la reconnaissance.
const AppTile = ({ service }) => (
  <li>
    <a
      href={service.link}
      target="_blank"
      rel="noreferrer"
      onClick={trackClick(service, "secondary")}
      className="group flex h-full flex-col items-center gap-2 rounded-2xl p-2 text-center no-underline transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <img
        src={service.image}
        alt=""
        loading="lazy"
        className="h-14 w-14 rounded-2xl bg-white object-contain p-1.5 shadow-sm ring-1 ring-gray-200 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md"
      />
      <span className="text-xs font-semibold leading-tight text-secondary sm:text-sm">
        {service.name}
      </span>
    </a>
  </li>
);

const LinkGroup = ({ title, group, className = "", gridClassName }) => (
  <motion.section
    variants={itemVariants}
    className={`${cardClassName} ${className}`}
  >
    <h2 className="mb-3 text-lg font-semibold text-secondary">{title}</h2>
    <ul className={`grid list-none gap-1 p-0 ${gridClassName}`}>
      {links
        .filter((service) => service.group === group)
        .map((service) => (
          <AppTile key={service.name} service={service} />
        ))}
    </ul>
  </motion.section>
);

const Links = () => {
  const primaryLinks = links.filter((service) => !service.group);

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      <PageHeader icon={PageIcon} title="Liens utiles" />
      <motion.section variants={itemVariants} className={cardClassName}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {primaryLinks.map((service) => (
            <PrimaryLink key={service.name} service={service} />
          ))}
        </div>
      </motion.section>

      {/* 3 + 5 tuiles au-dessus de 8 : les colonnes restent alignées sur grand écran. */}
      <div className="grid gap-5 xl:grid-cols-[3fr_5fr]">
        <LinkGroup
          title="Ma promo"
          group="promo"
          gridClassName="grid-cols-3"
        />
        <LinkGroup
          title="Outils de l'école"
          group="tools"
          gridClassName="grid-cols-3 sm:grid-cols-5"
        />
        <LinkGroup
          title="Vie étudiante"
          group="campus"
          className="xl:col-span-2"
          gridClassName="grid-cols-3 sm:grid-cols-4 xl:grid-cols-8"
        />
      </div>
    </motion.div>
  );
};

export default Links;
