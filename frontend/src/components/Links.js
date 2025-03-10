import React from "react";
import { links } from "../data/links";

const ServiceItem = ({ service }) => (
  <li>
    <a href={service.link} target="_blank" rel="noreferrer">
      <img src={service.image} alt={`Icône ${service.name}`} />
      <span>{service.name}</span>
    </a>
  </li>
);

const Links = () => {
  return (
    <>
      <h2 className="module-title">Liens utiles</h2>
      <ul className="liste-services">
        {links.map((service, index) => (
          <ServiceItem key={index} service={service} />
        ))}
      </ul>
    </>
  );
};

export default Links;
