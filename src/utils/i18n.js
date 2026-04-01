// Dictionary for simple i18n
export const translations = {
  fr: {
    "nav.pos": "Caisse",
    "nav.inventory": "Inventaire",
    "nav.tables": "Tables",
    "nav.dashboard": "Gestion",
    "nav.settings": "Paramètres",
    "nav.help": "Aide",
    "pos.title": "Point de Vente",
    "pos.search": "Chercher un produit...",
    "pos.cart": "Commande",
    "pos.empty_cart": "Le panier est vide",
    "pos.checkout": "Encaisser & Imprimer",
    "pos.table_select": "-- Sans Table --",
    "pos.total": "Total",
    "inventory.title": "Gestion des Stocks",
    "inventory.new": "Nouveau Produit",
    "dashboard.title": "Gestion",
    "dashboard.revenue": "Chiffre d'Affaires",
    "dashboard.items": "Articles Vendus",
    "dashboard.alerts": "Alertes Stocks",
    "tables.title": "Gestion des Tables",
    "tables.free": "Libre",
    "tables.occupied": "Occupée",
    "tables.service": "Service Demandé",
    "menu.title": "Menu",
    "menu.search": "Rechercher une boisson...",
    "menu.order": "Commander"
  },
  en: {
    "nav.pos": "POS",
    "nav.inventory": "Inventory",
    "nav.tables": "Tables",
    "nav.dashboard": "Management",
    "nav.settings": "Settings",
    "nav.help": "Help",
    "pos.title": "Point of Sale",
    "pos.search": "Search a product...",
    "pos.cart": "Order",
    "pos.empty_cart": "Cart is empty",
    "pos.checkout": "Checkout & Print",
    "pos.table_select": "-- No Table --",
    "pos.total": "Total",
    "inventory.title": "Inventory Management",
    "inventory.new": "New Product",
    "dashboard.title": "Management",
    "dashboard.revenue": "Revenue",
    "dashboard.items": "Items Sold",
    "dashboard.alerts": "Stock Alerts",
    "tables.title": "Tables Management",
    "tables.free": "Free",
    "tables.occupied": "Occupied",
    "tables.service": "Pending Service",
    "menu.title": "Menu",
    "menu.search": "Search a drink...",
    "menu.order": "Order"
  }
};

import { useStore } from "../store/store";

export function useTranslation() {
  const language = useStore(state => state.language);
  return (key) => translations[language]?.[key] || key;
}
