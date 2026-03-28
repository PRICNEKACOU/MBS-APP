import { useStore } from '../store/store';

export const calculateHistoricalStock = (productId, selectedDateStr, products, movements) => {
  const product = products.find(p => p.id === productId);
  if (!product) return 0;
  
  const currentStock = product.stock;
  
  // Configure la date de fin (exactement 23:59:59.999 pour couvrir toute la journée sélectionnée)
  const selectedDateEnd = new Date(selectedDateStr);
  selectedDateEnd.setHours(23, 59, 59, 999);

  // Cherche tout ce qui s'est passé STRICTEMENT APRÈS la selectedDate (donc le 27, 28...)
  const futureMovements = movements.filter(m => {
    const moveDate = new Date(m.date);
    return moveDate > selectedDateEnd && m.productId === productId;
  });

  const futureIns = futureMovements
    .filter(m => m.type === 'IN')
    .reduce((sum, m) => sum + m.quantity, 0);
    
  const futureOuts = futureMovements
    .filter(m => m.type === 'OUT')
    .reduce((sum, m) => sum + m.quantity, 0);

  // Mathématique STRICTE : Stock Historique = Stock Actuel + Sorties Futures - Entrées Futures
  const historicalStock = currentStock + futureOuts - futureIns;
  
  return Math.max(0, historicalStock);
};
