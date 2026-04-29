import React from "react";
import { ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { links } from "../data/links";

const pageVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: "easeOut", staggerChildren: 0.035 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
};

const mainLinks = new Set(["Hyperplanning", "ENT", "Zimbra", "Moodle"]);

const ServiceItem = ({ service }) => (
  <motion.li variants={itemVariants} whileHover={{ y: -3 }}>
    <a
      href={service.link}
      target="_blank"
      rel="noreferrer"
      className="group flex h-full min-h-[112px] flex-col items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-4 text-center no-underline shadow-sm transition-all duration-200 hover:border-primary/35 hover:bg-slate-50 hover:shadow-md"
    >
      <span className="grid h-14 w-14 place-items-center rounded-xl bg-slate-50 ring-1 ring-gray-100 transition-transform duration-200 group-hover:-translate-y-0.5">
        <img src={service.image} alt="" className="h-10 w-10 object-contain" />
      </span>

      <span className="mt-3 flex max-w-full items-center gap-1.5 text-sm font-semibold text-gray-800">
        <span className="truncate">{service.name}</span>
        <ExternalLink
          size={13}
          className="shrink-0 text-slate-300 transition-colors group-hover:text-primary"
        />
      </span>
    </a>
  </motion.li>
);

const Links = () => {
  const primaryLinks = links.filter((service) => mainLinks.has(service.name));
  const secondaryLinks = links.filter((service) => !mainLinks.has(service.name));

  return (
    <motion.main
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="mx-auto w-full max-w-[1280px] px-2"
    >
      <motion.section
        variants={itemVariants}
        className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm md:p-6 lg:p-7"
      >
        <header className="mb-5 flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-900">Liens utiles</h1>
          <p className="text-sm text-gray-500">
            Les raccourcis importants de l'ecole et de la vie etudiante.
          </p>
        </header>

        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-extrabold text-gray-700">
              Liens principaux
            </h2>
            <motion.div
              variants={pageVariants}
              className="grid grid-cols-2 gap-3 xl:grid-cols-4"
            >
              {primaryLinks.map((service) => (
                <motion.a
                  key={service.name}
                  variants={itemVariants}
                  whileHover={{ y: -3 }}
                  href={service.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex min-h-[118px] flex-col items-center justify-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-center no-underline shadow-sm transition-all duration-200 hover:border-primary/40 hover:bg-white hover:shadow-md sm:flex-row sm:justify-start sm:p-4 sm:text-left"
                >
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-primary/10">
                    <img
                      src={service.image}
                      alt=""
                      className="h-10 w-10 object-contain"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-extrabold text-gray-900">
                      {service.name}
                    </span>
                    <span className="mt-1 hidden text-xs font-semibold text-gray-500 sm:block">
                      Acces rapide
                    </span>
                  </span>
                  <ExternalLink
                    size={16}
                    className="hidden shrink-0 text-slate-300 transition-colors group-hover:text-primary sm:block"
                  />
                </motion.a>
              ))}
            </motion.div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-extrabold text-gray-700">
              Autres liens
            </h2>
            <motion.ul
              variants={pageVariants}
              className="grid grid-cols-2 list-none gap-3 p-0 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
            >
              {secondaryLinks.map((service) => (
                <ServiceItem key={service.name} service={service} />
              ))}
            </motion.ul>
          </section>
        </div>
      </motion.section>
    </motion.main>
  );
};

export default Links;
