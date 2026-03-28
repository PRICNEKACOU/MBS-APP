export const formatPrice = (price) => {
  return `${price.toLocaleString('fr-FR', { maximumFractionDigits: 0 }).replace(/,/g, ' ')} FCFA`;
};
