/**
 * Devise native : FCFA (Franc CFA Ouest-Africain, XOF)
 * Le FCFA est arrimé à l'Euro à taux fixe depuis 1999 (accord CFA zone).
 * Ce taux ne change pas par le marché, mais toute révision institutionnelle
 * doit être reflétée ici avec une mise à jour de CFA_RATE_UPDATED_AT.
 */
export const CFA_RATE = 655.957;

/** Date de la dernière vérification/mise à jour du taux */
export const CFA_RATE_UPDATED_AT = new Date('2025-01-01');

/**
 * Retourne true si le taux n'a pas été vérifié depuis plus de 30 jours.
 * Utile pour afficher un avertissement dans l'interface.
 */
export function isCfaRateStale() {
  const msPerDay = 1000 * 60 * 60 * 24;
  return (Date.now() - CFA_RATE_UPDATED_AT.getTime()) / msPerDay > 30;
}

/**
 * Formate un prix (stocké en EUR en base) vers FCFA pour l'affichage.
 * Le second paramètre est conservé pour rétrocompatibilité mais ignoré —
 * l'application utilise exclusivement le FCFA.
 *
 * @param {number} basePrice - Prix en EUR (valeur interne)
 * @returns {string} — ex: "1 500 FCFA"
 */
export const formatPrice = (basePrice) => {
  const fcfa = Math.round((basePrice ?? 0) * CFA_RATE);
  return `${fcfa.toLocaleString('fr-FR').replace(/\s/g, '\u00a0')} FCFA`;
};
