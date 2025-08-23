import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Book, Info } from 'lucide-react';

// Helper
const getApiUrl = (path) => `${process.env.REACT_APP_URL_BACK}${path}`;

// --- Sous-composants ---

const GenreFilters = ({ genres, selectedGenre, onSelectGenre }) => {
  const totalBooks = useMemo(() => genres.reduce((sum, g) => sum + parseInt(g.count, 10), 0), [genres]);

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-3 text-text-secondary">Parcourir par genre</h3>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelectGenre(null)}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            selectedGenre === null ? 'bg-primary text-white shadow-md' : 'bg-background-module text-text-secondary hover:bg-border-light'
          }`}
        >
          Tous ({totalBooks})
        </button>
        {genres.map(g => g.genre && (
          <button
            key={g.genre}
            onClick={() => onSelectGenre(g.genre)}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              selectedGenre === g.genre ? 'bg-primary text-white shadow-md' : 'bg-background-module text-text-secondary hover:bg-border-light'
            }`}
          >
            {g.genre} ({g.count})
          </button>
        ))}
      </div>
    </div>
  );
};

const BookCard = ({ book, onSelect }) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    transition={{ duration: 0.3 }}
    onClick={() => onSelect(book)}
    className="relative bg-background-module p-4 rounded-lg shadow-sm hover:shadow-lg transition-shadow cursor-pointer border border-border-light"
  >
    <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${book.is_available ? 'bg-success' : 'bg-danger'}`} title={book.is_available ? 'Disponible' : 'Réservé'}></div>
    <div className="flex flex-col h-full">
      <div className="flex-grow mb-2">
        <h3 className="font-bold text-md text-text-primary leading-tight">{book.title}</h3>
        <p className="text-sm text-text-secondary mt-1">{book.author}</p>
      </div>
      <div className="flex justify-end items-center text-primary">
        <Info size={16} />
      </div>
    </div>
  </motion.div>
);


// --- Composant principal ---

function Bibli({ user }) {
  const [view, setView] = useState('catalogue');
  const [books, setBooks] = useState([]);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [myReservations, setMyReservations] = useState([]);
  const [allReservations, setAllReservations] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reservationError, setReservationError] = useState(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [booksResponse, genresResponse] = await Promise.all([
          axios.get(getApiUrl('/api/bibli/books')),
          axios.get(getApiUrl('/api/bibli/genres'))
        ]);
        setBooks(booksResponse.data);
        setGenres(genresResponse.data);
        setError(null);
      } catch (err) {
        setError('Erreur lors du chargement des données. Veuillez réessayer plus tard.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  const filteredBooks = useMemo(() => {
    if (!selectedGenre) return books;
    return books.filter(book => book.genre === selectedGenre);
  }, [books, selectedGenre]);


  // ... (toutes les fonctions handle et fetch restent les mêmes)
  const fetchMyReservations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(getApiUrl('/api/bibli/reservations/mine'), { withCredentials: true });
      setMyReservations(response.data);
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement de vos réservations.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCancelReservation = async (reservationId, bookId) => {
    try {
      await axios.put(getApiUrl(`/api/bibli/reservations/${reservationId}/cancel`), 
        {},
        { withCredentials: true }
      );
      setMyReservations(prev => prev.filter(res => res.id !== reservationId));
      setBooks(prevBooks => prevBooks.map(book => 
        book.id === bookId ? { ...book, is_available: true } : book
      ));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Erreur lors de l'annulation.");
    }
  };

  const handleReservation = async () => {
    setReservationError(null);
    try {
      await axios.post(getApiUrl('/api/bibli/reservations'), 
        { book_id: selectedBook.id },
        { withCredentials: true }
      );
      setSelectedBook(prev => ({ ...prev, is_available: false }));
      setBooks(prevBooks => prevBooks.map(book => 
        book.id === selectedBook.id ? { ...book, is_available: false } : book
      ));
    } catch (err) {
      const message = err.response?.data?.message || 'Une erreur est survenue lors de la réservation.';
      setReservationError(message);
      console.error(err);
    }
  };

  const fetchAdminReservations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(getApiUrl('/api/bibli/admin/reservations'), { withCredentials: true });
      setAllReservations(response.data);
      setError(null);
    } catch (err) {
      setError('Erreur lors du chargement des réservations admin.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateReservationStatus = async (reservationId, status) => {
    const return_date = status === 'validated' ? prompt('Entrez la date de retour (YYYY-MM-DD):') : null;
    if (status === 'validated' && !return_date) return;

    try {
      const response = await axios.put(
        getApiUrl(`/api/bibli/admin/reservations/${reservationId}`),
        { status, return_date },
        { withCredentials: true }
      );
      setAllReservations(prev => prev.map(r => r.id === reservationId ? response.data : r));
    } catch (err) {
      alert('Erreur lors de la mise à jour.');
      console.error(err);
    }
  };

  const handleAddBook = async () => {
    const title = prompt('Titre du livre:');
    const author = prompt('Auteur du livre:');
    if (!title || !author) return;

    try {
      const response = await axios.post(getApiUrl('/api/bibli/admin/books'), { title, author }, { withCredentials: true });
      setBooks(prev => [...prev, response.data]);
    } catch (err) {
      alert('Erreur lors de l\'ajout du livre.');
    }
  };

  const handleDeleteBook = async (bookId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce livre ?')) return;

    try {
      await axios.delete(getApiUrl(`/api/bibli/admin/books/${bookId}`), { withCredentials: true });
      setBooks(prev => prev.filter(b => b.id !== bookId));
    } catch (err) {
      alert('Erreur lors de la suppression.');
    }
  };


  // --- Rendu des Vues ---

  const renderCatalogue = () => (
    <div>
      <GenreFilters genres={genres} selectedGenre={selectedGenre} onSelectGenre={setSelectedGenre} />
      <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {filteredBooks.map(book => (
          <BookCard key={book.id} book={book} onSelect={() => {
            setSelectedBook(book);
            setView('details');
          }} />
        ))}
      </motion.div>
    </div>
  );

  const renderBookDetails = () => {
    if (!selectedBook) return null;
    
    return (
      <div>
        <button onClick={() => setView('catalogue')} className="mb-4 text-primary hover:underline flex items-center gap-2">
          <Book size={16} /> Retour au catalogue
        </button>
        <h2 className="text-3xl font-bold">{selectedBook.title}</h2>
        <p className="text-xl text-text-secondary mb-4">{selectedBook.author}</p>
        <div className="p-4 bg-background-module rounded-lg">
          <h3 className="font-bold mb-2">Informations</h3>
          <p><strong>Genre:</strong> {selectedBook.genre || 'Non spécifié'}</p>
          <p><strong>Année:</strong> {selectedBook.year || 'Non spécifiée'}</p>
          <p>
            <strong>Disponibilité:</strong> 
            <span className={`ml-2 font-semibold ${selectedBook.is_available ? 'text-success' : 'text-danger'}`}>
              {selectedBook.is_available ? 'Disponible' : 'Actuellement réservé'}
            </span>
          </p>
        </div>
        {reservationError && <p className="text-red-500 mt-4">{reservationError}</p>}
        {selectedBook.is_available ? (
          <button 
            onClick={handleReservation}
            className="mt-6 w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary-dark transition-colors"
          >
            Réserver ce livre
          </button>
        ) : (
          <p className="mt-6 text-center font-semibold text-text-secondary bg-background-module p-3 rounded-lg">Ce livre est déjà réservé.</p>
        )}
      </div>
    );
  };

  const renderMyReservations = () => ( // ... reste inchangé
    <div>
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Mes Réservations</h2>
      {myReservations.length === 0 ? (
        <p className="text-gray-600">Vous n'avez aucune réservation pour le moment.</p>
      ) : (
        <div className="space-y-4">
          {myReservations.map(res => (
            <div key={res.id} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
              <div>
                <p className="font-bold">{res.books.title}</p>
                <p className="text-sm text-gray-600">par {res.books.author}</p>
              </div>
              <div className="text-right">
                <p className={`font-semibold capitalize ${
                  res.status === 'validated' ? 'text-green-600' : 
                  res.status === 'pending' ? 'text-yellow-600' : 'text-gray-500'
                }`}>
                  {res.status === 'pending' ? 'En attente' : 
                   res.status === 'validated' ? `Validée (Retour le ${new Date(res.return_date).toLocaleDateString()})` :
                   'Terminée'}
                </p>
                {res.status === 'pending' && (
                  <button 
                    onClick={() => handleCancelReservation(res.id, res.books.id)}
                    className="text-sm text-red-600 hover:underline mt-1 disabled:text-gray-400"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  
  const renderAdminReservations = () => ( // ... reste inchangé
    <div>
      <h2 className="text-2xl font-bold mb-4 text-red-700">Gestion des Réservations</h2>
      <div className="space-y-4">
        {allReservations.map(res => (
          <div key={res.id} className="bg-yellow-50 p-4 rounded-lg shadow-sm">
            <div className="flex justify-between items-start">
               <div>
                <p className="font-bold">{res.books ? res.books.title : '[Livre supprimé]'}</p>
                <p className="text-sm text-gray-600">
                  Demandé par: 
                  <span className="font-medium">{res.users ? res.users.display_name : '[Utilisateur supprimé]'}</span> 
                  ({res.users ? res.users.username : 'N/A'})
                </p>
                <p className="text-xs text-gray-500 mt-1">Le: {new Date(res.reservation_date).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold capitalize">{res.status}</p>
                {res.status === 'validated' && <p className="text-xs">Retour le: {new Date(res.return_date).toLocaleDateString()}</p>}
              </div>
            </div>
            {res.status === 'pending' && (
              <div className="mt-3 pt-3 border-t border-yellow-200 flex space-x-2">
                <button onClick={() => handleUpdateReservationStatus(res.id, 'validated')} className="bg-green-500 text-white px-3 py-1 text-sm rounded hover:bg-green-600">Valider</button>
                <button onClick={() => handleUpdateReservationStatus(res.id, 'cancelled')} className="bg-red-500 text-white px-3 py-1 text-sm rounded hover:bg-red-600">Refuser</button>
              </div>
            )}
            {res.status === 'validated' && (
              <div className="mt-3 pt-3 border-t border-yellow-200">
                <button onClick={() => handleUpdateReservationStatus(res.id, 'returned')} className="bg-blue-500 text-white px-3 py-1 text-sm rounded hover:bg-blue-600">Marquer comme Rendu</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
  
  const renderAdminBooks = () => ( // ... reste inchangé
    <div>
      <h2 className="text-2xl font-bold mb-4 text-red-700">Gestion des Livres</h2>
      <button onClick={handleAddBook} className="mb-4 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700">
        + Ajouter un livre
      </button>
      <div className="space-y-2">
        {books.map(book => (
          <div key={book.id} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
            <div>
              <p className="font-bold">{book.title}</p>
              <p className="text-sm text-gray-600">{book.author}</p>
            </div>
            <div className="flex space-x-2">
              <button className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600" disabled>Modifier</button>
              <button onClick={() => handleDeleteBook(book.id)} className="text-sm bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">Supprimer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  
  // --- RENDU PRINCIPAL ---

  return (
    <div className="p-4 md:p-6 bg-background min-h-screen">
      <div className="container mx-auto">
        <header className="mb-6">
          <h1 className="text-4xl font-extrabold text-text-primary">Bibliothèque</h1>
          <div className="mt-4 border-b border-border-light">
            <nav className="-mb-px flex space-x-6 overflow-x-auto">
              <button
                onClick={() => setView('catalogue')}
                className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  view === 'catalogue' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
                }`}
              >
                Catalogue
              </button>
              <button
                onClick={() => {
                  setView('my_reservations');
                  fetchMyReservations();
                }}
                className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  view === 'my_reservations' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
                }`}
              >
                Mes Réservations
              </button>
              {user?.is_bibli_admin && (
                <button
                  onClick={() => {
                    setView('admin_reservations');
                    fetchAdminReservations();
                  }}
                  className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    view === 'admin_reservations' ? 'border-danger text-danger' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
                  }`}
                >
                  Admin: Réservations
                </button>
              )}
              {user?.is_bibli_admin && (
                <button
                  onClick={() => setView('admin_books')}
                  className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    view === 'admin_books' ? 'border-danger text-danger' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
                  }`}
                >
                  Admin: Livres
                </button>
              )}
            </nav>
          </div>
        </header>
        
        <main>
          {loading && <div className="text-center p-10"><p>Chargement...</p></div>}
          {error && <div className="text-center p-10 text-danger"><p>{error}</p></div>}
          
          {!loading && !error && (
            <>
              {view === 'catalogue' && renderCatalogue()}
              {view === 'details' && renderBookDetails()}
              {view === 'my_reservations' && renderMyReservations()}
              {view === 'admin_reservations' && renderAdminReservations()}
              {view === 'admin_books' && renderAdminBooks()}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default Bibli;
