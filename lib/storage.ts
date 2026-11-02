import { INITIAL_PRODUCTS, type Product, type Order } from "@/data/catalog";
export const CATALOG_KEY = "lataberna-catalog-v1";
export const CART_KEY = "lataberna-cart-v1";
export const ORDERS_KEY = "lataberna-orders-v1";
export const SYNC_EVENT = "lataberna-data-change";

export function readCatalog(): Product[] {
  if (typeof window === "undefined") return INITIAL_PRODUCTS;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CATALOG_KEY) || "null");
    if (Array.isArray(value) && value.every((p) => p && typeof p.id === "number" && typeof p.name === "string" && typeof p.stock === "number" && typeof p.price === "number" && typeof p.active === "boolean")) return value as Product[];
  } catch {}
  return INITIAL_PRODUCTS;
}
export function writeCatalog(list: Product[]) {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(SYNC_EVENT));
}
export function readCart(): Record<string,number> {
  if (typeof window === "undefined") return {};
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string,number>;
  } catch {}
  return {};
}
export function writeCart(cart: Record<string,number>) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event(SYNC_EVENT));
}
export function readOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
    if (Array.isArray(value)) return value as Order[];
  } catch {}
  return [];
}
export function writeOrders(orders: Order[]) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event(SYNC_EVENT));
}
export const idForOrder = () => `LT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
