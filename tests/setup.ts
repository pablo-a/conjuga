// IndexedDB n'existe pas dans jsdom. Les tests qui touchent la persistance ont
// besoin d'une implémentation réelle plutôt que d'un bouchon : c'est justement
// le comportement de Dexie — transactions, index, clés composées — qu'ils
// vérifient, et un faux `db` ne vérifierait que lui-même.
import 'fake-indexeddb/auto'
