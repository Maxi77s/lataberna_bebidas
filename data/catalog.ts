export const CATEGORIES = ["Todas", "Cervezas", "Vinos", "Destilados", "Aperitivos"] as const;
export type Category = Exclude<(typeof CATEGORIES)[number], "Todas">;
export type Product = {
  id: number;
  name: string;
  category: Category;
  volume: string;
  description: string;
  price: number;
  stock: number;
  image: string;
  badge?: string;
  active: boolean;
};
export type OrderItem = { id: number; name: string; quantity: number; price: number };
export type Order = {
  id: string;
  customer: string;
  phone: string;
  delivery: "Retiro" | "Envío";
  address: string;
  payment: string;
  notes: string;
  createdAt: string;
  items: OrderItem[];
  total: number;
  status: "pendiente" | "completado";
  origin: "web" | "manual";
};
export const INITIAL_PRODUCTS: Product[] = [
  { id: 1, name: "Fernet Branca", category: "Aperitivos", volume: "750 ml", price: 14500, stock: 18, image: "/images/fernet-branca.webp", badge: "EL CLÁSICO", description: "Aperitivo tradicional, ideal para compartir.", active: true },
  { id: 2, name: "Gin Bombay Sapphire", category: "Destilados", volume: "750 ml", price: 28900, stock: 12, image: "/images/gin-bombay.webp", badge: "DESTACADO", description: "Gin de notas botánicas y perfil fresco.", active: true },
  { id: 3, name: "Cerveza Corona Extra", category: "Cervezas", volume: "710 ml", price: 4900, stock: 30, image: "/images/corona-extra.webp", description: "Cerveza ligera, para tomar bien fría.", active: true },
  { id: 4, name: "Malbec Trapiche", category: "Vinos", volume: "750 ml", price: 7800, stock: 14, image: "/images/malbec-trapiche.webp", description: "Vino Malbec, compañero de una buena mesa.", active: true },
  { id: 5, name: "Aperol Aperitivo", category: "Aperitivos", volume: "750 ml", price: 16900, stock: 16, image: "/images/aperol.webp", badge: "PARA COMPARTIR", description: "Aperitivo cítrico y refrescante.", active: true },
  { id: 6, name: "Vodka Absolut", category: "Destilados", volume: "700 ml", price: 19500, stock: 9, image: "/images/vodka-absolut.webp", description: "Vodka versátil para tus cócteles.", active: true },
];
export const money = (n: number) => "$ " + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);
export const WHATSAPP_PHONE = "543585097630";
