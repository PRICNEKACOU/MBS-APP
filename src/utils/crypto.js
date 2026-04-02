/**
 * hashPin — SHA-256 hash via Web Crypto API (disponible nativement dans tous les navigateurs modernes).
 * Utilisé pour ne jamais stocker ni comparer les PIN staff en clair.
 *
 * @param {string} pin - Le PIN en clair à hacher
 * @returns {Promise<string>} - Hex digest SHA-256 (64 caractères)
 */
export async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * isPinHashed — Vérifie si une valeur est déjà un hash SHA-256 (64 hex chars).
 * Utilisé pour la migration progressive : les anciens PIN en clair sont détectés
 * et automatiquement mis à niveau lors de la prochaine connexion.
 *
 * @param {string} pin
 * @returns {boolean}
 */
export function isPinHashed(pin) {
  return typeof pin === 'string' && /^[0-9a-f]{64}$/.test(pin);
}
