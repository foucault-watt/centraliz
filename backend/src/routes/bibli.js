const express = require('express');
const router = express.Router();
const bibliService = require('../services/bibliService');
const authMiddleware = require("../middlewares/auth");
const bibliAdminMiddleware = require('../middlewares/bibliAdmin');

// Route pour obtenir la liste des livres avec filtres
// GET /api/bibli/books?search=...&genre=...&available=...&sortBy=...
router.get('/books', async (req, res) => {
  try {
    const { data, error } = await bibliService.getAllBooks(req.query);
    if (error) throw new Error(error.message);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Route pour obtenir les détails d'un livre spécifique
// GET /api/bibli/books/:id
router.get('/books/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await bibliService.getBookById(id);
    if (error) {
      return res.status(404).json({ message: error.message });
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Route pour obtenir la liste des genres avec le nombre de livres
// GET /api/bibli/genres
router.get('/genres', async (req, res) => {
  try {
    const { data, error } = await bibliService.getGenresWithCount();
    if (error) throw new Error(error.message);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Route pour créer une réservation
// POST /api/bibli/reservations
router.post('/reservations', authMiddleware, async (req, res) => {
  try {
    const { book_id } = req.body;
    const username = req.session.user.userName; // Utiliser userName pour la compatibilité
    
    if (!book_id) {
      return res.status(400).json({ message: 'Book ID is required.' });
    }

    const { data, error } = await bibliService.createReservation(username, book_id);

    if (error) {
      // Gérer les erreurs spécifiques, par exemple si le livre n'est pas disponible
      if (error.message.includes('not available')) {
        return res.status(409).json({ message: 'Ce livre n\'est plus disponible.' });
      }
      throw new Error(error.message);
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Route pour obtenir les réservations de l'utilisateur connecté
// GET /api/bibli/reservations/mine
router.get('/reservations/mine', authMiddleware, async (req, res) => {
  try {
    const username = req.session.user.userName;
    const { data, error } = await bibliService.getUserReservations(username);

    if (error) throw new Error(error.message);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Route pour annuler une réservation
// PUT /api/bibli/reservations/:id/cancel
router.put('/reservations/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.session.user.userName;
    
    const { data, error } = await bibliService.cancelReservation(id, username);

    if (error) {
      // Si l'erreur est une erreur d'autorisation ou de logique métier, renvoyer un statut approprié
      if (error.message.includes('non autorisée') || error.message.includes('peut plus être annulée')) {
        return res.status(403).json({ message: error.message });
      }
      throw new Error(error.details || error.message);
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// --- Routes Administrateur ---
const adminRouter = express.Router();

// Appliquer le middleware d'administration à toutes les routes de ce routeur
adminRouter.use(bibliAdminMiddleware);

// GET /api/bibli/admin/reservations - Lister toutes les réservations
adminRouter.get('/reservations', async (req, res) => {
  try {
    const { data, error } = await bibliService.getAllReservations();
    if (error) throw new Error(error.message);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/bibli/admin/reservations/:id - Mettre à jour une réservation
adminRouter.put('/reservations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, return_date } = req.body;
    const { data, error } = await bibliService.updateReservationStatus(id, status, return_date);
    if (error) throw new Error(error.message);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/bibli/admin/books - Ajouter un livre
adminRouter.post('/books', async (req, res) => {
    try {
        const { data, error } = await bibliService.createBook(req.body);
        if (error) throw new Error(error.message);
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/bibli/admin/books/:id - Mettre à jour un livre
adminRouter.put('/books/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await bibliService.updateBook(id, req.body);
        if (error) throw new Error(error.message);
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE /api/bibli/admin/books/:id - Supprimer un livre
adminRouter.delete('/books/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await bibliService.deleteBook(id);
        if (error) throw new Error(error.message);
        res.status(204).send(); // No content
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// Monter le routeur admin sur le chemin /admin
router.use('/admin', adminRouter);


module.exports = router;
