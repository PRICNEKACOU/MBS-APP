import { createClient } from '@insforge/sdk';

/**
 * VITE_INSFORGE_ANON_KEY — Clé publique anonyme (safe côté client)
 *
 * Cette clé est intentionnellement exposée dans le bundle JS. Elle permet
 * uniquement les opérations autorisées par les politiques RLS configurées
 * sur InsForge. Elle NE donne PAS accès aux données d'autres restaurants.
 *
 * Permissions accordées à cette clé :
 *   - Auth : signUp, signIn, verifyEmail, resetPassword
 *   - Database : lecture/écriture filtrée par restaurant_id via RLS
 *   - Realtime : subscribe aux canaux orders/products/tables
 *
 * Ce qui est PROTÉGÉ côté serveur (RLS) :
 *   - Isolation totale des données entre restaurants (restaurant_id)
 *   - Accès admin-only pour cycles, expenses, staff CRUD
 *   - pin_code jamais renvoyé en SELECT (à ajouter en column-level security si besoin)
 *
 * Ne jamais utiliser la service_role key côté client.
 */
const supabaseUrl = import.meta.env.VITE_INSFORGE_URL;
const supabaseAnonKey = import.meta.env.VITE_INSFORGE_ANON_KEY;

export const insforge = createClient({
  baseUrl: supabaseUrl,
  anonKey: supabaseAnonKey
});
