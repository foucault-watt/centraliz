
import React from 'react';
import Mail from '../components/Mail';
import Links from '../components/Links';

const MailLinksPage = () => {
  return (
    <div className="page mail-links-page">
      <div className="page-content">
        <div className="div-mail">
          <Mail />
        </div>
        <div className="div-links">
          <Links />
        </div>
      </div>
    </div>
  );
};

export default MailLinksPage;