const supabase = require("../utils/supabaseClient");
const axios = require("axios");

const OPEN_LIBRARY_API = "https://openlibrary.org";

/**
 * Récupère tous les livres avec filtres, tri et pagination.
 * @param {object} filters - Les filtres à appliquer (search, genre).
 * @param {number} page - Le numéro de la page.
 * @param {number} limit - Le nombre d'éléments par page.
 * @returns {Promise<{data: any, count: number, error: any}>}
 */
const getAllBooks = async (filters = {}, page = 1, limit = 50) => {
  let query = supabase.from("books").select("*", { count: 'exact' });

  // Filtre de recherche par titre ou auteur
  if (filters.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,author.ilike.%${filters.search}%`
    );
  }

  // Filtre par genre
  if (filters.genre) {
    query = query.eq("genre", filters.genre);
  }

  // Tri
  query = query.order("title", { ascending: true });

  // Pagination
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  return { data, error, count };
};


/**
 * Récupère un livre par son ID et l'enrichit avec les données d'OpenLibrary.
 * @param {number} id - L'ID du livre.
 * @returns {Promise<{data: any, error: any}>}
 */
const getBookById = async (id) => {
  // 1. Récupérer les données de notre BDD
  const { data: book, error } = await supabase
    .from("books")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !book) {
    return { data: null, error: error || new Error("Book not found") };
  }

  // 2. Enrichir avec OpenLibrary (si un ISBN ou OLID est disponible)
  // Note: Nous devons ajouter une colonne 'isbn' ou 'olid' à notre table 'books' pour que cela fonctionne.
  // Pour l'instant, nous allons simuler cette partie en retournant simplement les données du livre.
  
  return { data: book, error: null };
};

/**
 * Crée une réservation pour un livre.
 * Met à jour la disponibilité du livre.
 * @param {string} username - Le nom de l'utilisateur qui réserve.
 * @param {number} bookId - L'ID du livre à réserver.
 * @returns {Promise<{data: any, error: any}>}
 */
const createReservation = async (username, bookId) => {
  // On utilise une transaction pour s'assurer que les deux opérations réussissent ou échouent ensemble.
  const { data, error } = await supabase.rpc(
    "create_reservation_and_update_book",
    {
      p_user_username: username,
      p_book_id: bookId,
    }
  );

  if (error) {
    console.error("Error during transaction:", error);
    return { data: null, error };
  }

  return { data, error: null };
};

/**
 * Récupère les réservations d'un utilisateur.
 * @param {string} username - Le nom de l'utilisateur.
 * @returns {Promise<{data: any, error: any}>}
 */
const getUserReservations = async (username) => {
  return supabase
    .from("books_reservations")
    .select(
      `
      *,
      books (*)
    `
    )
    .eq("user_username", username);
};

// --- Fonctions Administrateur ---

/**
 * Récupère toutes les réservations avec filtres et pagination.
 * @param {object} filters - Les filtres (ex: { status: 'active' })
 * @param {number} page - Le numéro de page
 * @param {number} limit - Le nombre d'éléments par page
 * @returns {Promise<{data: any, count: number, error: any}>}
 */
const getAllReservations = async (filters = {}, page = 1, limit = 20) => {
  let query = supabase
    .from("books_reservations")
    .select(
      `
      *,
      users (username, display_name),
      books (title, author)
    `, { count: 'exact' }
    );

  // Filtre par statut
  if (filters.status === 'active') {
    query = query.in('status', ['pending', 'validated']);
  }
  // Si aucun filtre de statut, on récupère tout

  // Tri et pagination
  const offset = (page - 1) * limit;
  query = query.order("reservation_date", { ascending: false })
               .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  return { data, error, count };
};

/**
 * Met à jour le statut d'une réservation.
 * @param {string} id - L'ID de la réservation.
 * @param {string} status - Le nouveau statut ('validated', 'returned', 'cancelled').
 * @param {string|null} returnDate - La date de retour si le statut est 'validated'.
 * @returns {Promise<{data: any, error: any}>}
 */
const updateReservationStatus = async (id, status, returnDate = null) => {
  // Si le livre est retourné, il redevient disponible.
  if (status === "returned" || status === "cancelled") {
    const { data: reservation, error: fetchError } = await supabase
      .from("books_reservations")
      .select("book_id")
      .eq("id", id)
      .single();
    if (fetchError) return { data: null, error: fetchError };

    const { error: updateBookError } = await supabase
      .from("books")
      .update({ is_available: true })
      .eq("id", reservation.book_id);
    if (updateBookError) return { data: null, error: updateBookError };
  }

  return supabase
    .from("books_reservations")
    .update({ status, return_date: returnDate })
    .eq("id", id)
    .select()
    .single();
};

/**
 * Crée un nouveau livre.
 * @param {object} bookData - Les données du livre.
 * @returns {Promise<{data: any, error: any}>}
 */
const createBook = async (bookData) => {
  return supabase.from("books").insert(bookData).select().single();
};

/**
 * Met à jour un livre.
 * @param {number} id - L'ID du livre.
 * @param {object} bookData - Les données à mettre à jour.
 * @returns {Promise<{data: any, error: any}>}
 */
const updateBook = async (id, bookData) => {
  return supabase.from("books").update(bookData).eq("id", id).select().single();
};

/**
 * Supprime un livre.
 * @param {number} id - L'ID du livre.
 * @returns {Promise<{data: any, error: any}>}
 */
const deleteBook = async (id) => {
  return supabase.from("books").delete().eq("id", id);
};

/**
 * Annule une réservation si elle est en attente et appartient à l'utilisateur.
 * @param {string} reservationId - L'ID de la réservation.
 * @param {string} username - Le nom de l'utilisateur.
 * @returns {Promise<{data: any, error: any}>}
 */
const cancelReservation = async (reservationId, username) => {
  const { data: reservation, error: fetchError } = await supabase
    .from("books_reservations")
    .select("*")
    .eq("id", reservationId)
    .single();

  if (fetchError)
    return {
      data: null,
      error: { message: "Réservation non trouvée.", details: fetchError },
    };
  if (reservation.user_username !== username)
    return { data: null, error: { message: "Action non autorisée." } };
  if (reservation.status !== "pending")
    return {
      data: null,
      error: { message: "Cette réservation ne peut plus être annulée." },
    };

  // Utiliser la fonction existante pour mettre à jour le statut et la disponibilité du livre.
  return updateReservationStatus(reservationId, "cancelled");
};

/**
 * Récupère la liste des genres avec le nombre de livres pour chacun.
 * @returns {Promise<{data: any, error: any}>}
 */
const getGenresWithCount = async () => {
  return supabase.rpc('get_genre_counts');
};

module.exports = {
  getAllBooks,
  getBookById,
  getGenresWithCount,
  createReservation,
  getUserReservations,
  cancelReservation,
  // Admin
  getAllReservations,
  updateReservationStatus,
  createBook,
  updateBook,
  deleteBook,
};
