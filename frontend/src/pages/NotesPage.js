
import React from 'react';
import Notes from '../components/Notes';

const NotesPage = () => {
  return (
    <div className="page notes-page">
      <div className="page-content">
        <div className="div-notes">
          <Notes />
        </div>
      </div>
    </div>
  );
};

export default NotesPage;