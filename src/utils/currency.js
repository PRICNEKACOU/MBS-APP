const EXCHANGE_RATES = {
  EUR: 1,
  CFA: 655.957,
  USD: 1.08 // Aproximatif
};

export const formatPrice = (basePrice, activeCurrency = 'CFA') => {
  const rate = EXCHANGE_RATES[activeCurrency] || 1;
  const converted = basePrice * rate;

  if (activeCurrency === 'CFA') {
    return `${Math.round(converted).toLocaleString('fr-FR').replace(/,/g, ' ')} FCFA`;
  }

  if (activeCurrency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(converted);
  }

  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(converted);
};
