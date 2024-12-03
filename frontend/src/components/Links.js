import React from "react";

const services = [
  {
    name: "Hyperplanning",
    link: "https://planning.centralelille.fr/",
    image: process.env.PUBLIC_URL + "/links/hyperplanning.png",
  },
  {
    name: "ENT",
    link: "https://ent.centralelille.fr/",
    image: process.env.PUBLIC_URL + "/links/centrale.png",
  },
  {
    name: "Zimbra",
    link: "https://mail.centralelille.fr/",
    image: process.env.PUBLIC_URL + "/links/zimbra.png",
  },
  {
    name: "Moodle",
    link: "https://moodle2425.centralelille.fr/",
    image: process.env.PUBLIC_URL + "/links/moodle.png",
  },
  {
    name: "Web Aurion",
    link: "https://webaurion.centralelille.fr/",
    image: process.env.PUBLIC_URL + "/links/webaurion.png",
  },
  {
    name: "Print",
    link: "https://print.centralelille.fr/",
    image: process.env.PUBLIC_URL + "/links/print.png",
  },
  {
    name: "Facebook",
    link: "https://www.facebook.com/groups/admis2024centralelille/",
    image: process.env.PUBLIC_URL + "/links/facebook.png",
  },
  {
    name: "CLA",
    link: "https://centralelilleassos.fr/",
    image: process.env.PUBLIC_URL + "/links/cla.png",
  },
  {
    name: "Pain'Gouin",
    link: "https://paingouin.rezoleo.fr/",
    image: process.env.PUBLIC_URL + "/links/paingouin.png",
  },
  {
    name: "Eclosion",
    link: "https://eclosion.rezoleo.fr/",
    image: process.env.PUBLIC_URL + "/links/eclosion.png",
  },
  {
    name: "My'Iteem",
    link: "https://myiteem.fr/",
    image: process.env.PUBLIC_URL + "/links/myiteem.png",
  },
  {
    name: "Le Clap",
    link: "https://le-clap.fr/",
    image: process.env.PUBLIC_URL + "/links/clap.png",
  },
  {
    name: "BDS",
    link: "https://bds-centralelille.fr/",
    image: process.env.PUBLIC_URL + "/links/bds.png",
  },
  {
    name: "Sans Trash 2027",
    link: "https://www.facebook.com/groups/1931896207233319/",
    image: process.env.PUBLIC_URL + "/links/sans-trash.svg",
  },
  {
    name: "Black-Out 2027",
    link: "https://www.facebook.com/groups/536028622198593/",
    image: process.env.PUBLIC_URL + "/links/black-out.png",
  },
];

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
    <ul className="liste-services">
      {services.map((service, index) => (
        <ServiceItem key={index} service={service} />
      ))}
    </ul>
  );
};

export default Links;
