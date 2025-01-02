import React, { useState, useEffect } from "react";

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
    link: "https://moodle2425.centralelille.fr/login/index.php?authCAS=CAS",
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
    name: "Onshape",
    link: "https://centralelille.onshape.com/documents/",
    image: process.env.PUBLIC_URL + "/links/onshape.webp",
  },
  {
    name: "CLA",
    link: "https://centralelilleassos.fr/",
    image: process.env.PUBLIC_URL + "/links/cla.png",
  },
  {
    name: "Promo 2027",
    link: "https://www.facebook.com/groups/admis2024centralelille/",
    image: process.env.PUBLIC_URL + "/links/facebook.png",
  },
  {
    name: "Sans Trash 2027",
    link: "https://www.facebook.com/groups/1931896207233319/",
    image: process.env.PUBLIC_URL + "/links/sans-trash.png",
  },
  {
    name: "Black-Out 2027",
    link: "https://www.facebook.com/groups/536028622198593/",
    image: process.env.PUBLIC_URL + "/links/black-out.png",
  },
  {
    name: "BDS",
    link: "https://bds-centralelille.fr/",
    image: process.env.PUBLIC_URL + "/links/bds.png",
  },
  {
    name: "ENI",
    link: "http://ressources-electroniques.univ-lille.fr/login?url=https://www.eni-training.com/cs/univ-lille/",
    image: process.env.PUBLIC_URL + "/links/eni.png",
  },
  {
    name: "Europresse",
    link: "https://ressources-electroniques.univ-lille.fr/login?url=http://nouveau.europresse.com/access/ip/default.aspx?un=TourcoingT_1/",
    image: process.env.PUBLIC_URL + "/links/europresse.jpg",
  },
  {
    name: "File Sender",
    link: "https://filesender.renater.fr/index.php?s=upload/",
    image: process.env.PUBLIC_URL + "/links/file-sender.jpg",
  },
  {
    name: "Next Cloud",
    link: "https://nextcloud.centralelille.fr/",
    image: process.env.PUBLIC_URL + "/links/nextcloud.jpeg",
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
    name: "Absinthe",
    link: "https://absinthe.rezoleo.fr/",
    image: process.env.PUBLIC_URL + "/links/absinthe.svg",
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
    name: "Centr'All Games",
    link: "https://centrallgames.rezoleo.fr/",
    image: process.env.PUBLIC_URL + "/links/cag.png",
  },
  {
    name: "Rézoléo",
    link: "https://rezoleo.fr/",
    image: process.env.PUBLIC_URL + "/links/rezoleo.png",
  },
  {
    name: "Server Status",
    link: "https://status.rezoleo.fr/",
    image: process.env.PUBLIC_URL + "/links/status.svg",
  },
];

const ServiceItem = ({ service, active, onClick }) => (
  <li className={active ? "active" : ""} onClick={onClick}>
    <a href={active ? service.link : "#"} target="_blank" rel="noreferrer">
      <img src={service.image} alt={`Icône ${service.name}`} />
      <span>{service.name}</span>
    </a>
  </li>
);

const Links = () => {
  const [activeIndex, setActiveIndex] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleClick = (index) => (e) => {
    e.preventDefault(); // Empêche toujours la redirection par défaut
    
    if (isMobile) {
      if (activeIndex === index) {
        // Si déjà actif, ouvre dans un nouvel onglet
        window.open(services[index].link, '_blank', 'noopener,noreferrer');
      } else {
        // Première fois qu'on clique, afficher le nom
        setActiveIndex(index);
        setTimeout(() => {
          setActiveIndex(null);
        }, 3000);
      }
    } else {
      // Sur PC, ouvre directement dans un nouvel onglet
      window.open(services[index].link, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      <h2 className="module-title">Liens utiles</h2>
      <ul className="liste-services">
        {services.map((service, index) => (
          <ServiceItem
            key={index}
            service={service}
            active={activeIndex === index}
            onClick={handleClick(index)}
          />
        ))}
      </ul>
    </>
  );
};

export default Links;
