import React from "react";
import PageLayout from "./PageLayout";
import { Facebook, Github, LinkedinIcon, Mail, MessageSquare } from "lucide-react";

const ContactPage = () => {
  return (
    <PageLayout>
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4 flex items-center">
          <Mail className="mr-2" size={24} /> Contact
        </h2>
        <p className="text-gray-700">
          <strong>Foucault Wattinne</strong>
        </p>
        <a
          href="mailto:foucault.wattinne@iteem.centralelille.fr"
          className="text-blue-600 hover:underline mb-4 block"
        >
          foucault.wattinne@iteem.centralelille.fr
        </a>
        <div className="flex gap-4 mt-4">
          <a
            href="https://github.com/foucault-watt/centraliz"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          >
            <Github size={18} />
          </a>
          <a
            href="https://linkedin.com/in/foucault-wattinne"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          >
            <LinkedinIcon size={18} />
          </a>
          <a
            href="https://facebook.com/fukowatt"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          >
            <Facebook size={18} />
          </a>
          <a
            href="https://m.me/fukowatt"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          >
            <MessageSquare size={18} />
          </a>
        </div>
      </div>
    </PageLayout>
  );
};

export default ContactPage;