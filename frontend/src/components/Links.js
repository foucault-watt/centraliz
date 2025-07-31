import React from "react";
import { links } from "../data/links";
import { motion } from "framer-motion";

const ServiceItem = ({ service }) => (
  <motion.li
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
  >
    <a href={service.link} target="_blank" rel="noreferrer">
      <img src={service.image} alt={`Icône ${service.name}`} />
      <span>{service.name}</span>
    </a>
  </motion.li>
);

const Links = () => {
  return (
    <>
      <h2 className="module-title">Liens utiles</h2>
      <motion.ul
        className="liste-services"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.05,
            },
          },
        }}
      >
        {links.map((service, index) => (
          <ServiceItem key={index} service={service} />
        ))}
      </motion.ul>
    </>
  );
};

export default Links;
