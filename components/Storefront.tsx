"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Instagram,
  MapPin,
  MapPinned,
  Copy,
  Building2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  Trash2,
  Truck,
  Wallet,
  Wine,
  X,
} from "lucide-react";
import {
  CATEGORIES,
  INITIAL_PRODUCTS,
  money,
  type Product,
} from "@/data/catalog";
import { SYNC_EVENT, readCart, readCatalog, writeCart } from "@/lib/storage";

type Sheet = "cart" | "checkout" | null;
type Delivery = "Retiro" | "Envío";
type Sort = "destacados" | "menor" | "mayor" | "nombre";
type Customer = {
  name: string;
  phone: string;
  address: string;
  payment: string;
  notes: string;
  age: boolean;
};
type PreviewOrder = {
  customer: string;
  delivery: Delivery;
  payment: string;
  total: number;
  items: { name: string; quantity: number; amount: number }[];
};

type WholesaleRequest = {
  business: string;
  name: string;
  phone: string;
  city: string;
  products: string;
  delivery: string;
};

const wholesaleBlank: WholesaleRequest = {
  business: "",
  name: "",
  phone: "",
  city: "",
  products: "",
  delivery: "Retiro en el local",
};

const MAP_SEARCH_URL =
  "https://www.google.com/maps/search/?api=1&query=General%20Paz%20332%2C%20General%20Deheza%2C%20Cordoba%2C%20Argentina";
const MAP_EMBED_URL =
  "https://maps.google.com/maps?q=General%20Paz%20332%2C%20General%20Deheza%2C%20Cordoba%2C%20Argentina&z=16&output=embed";

const blank: Customer = {
  name: "",
  phone: "",
  address: "",
  payment: "",
  notes: "",
  age: false,
};
const INSTAGRAM = "https://www.instagram.com/lataberna_bebidas/";
const HERO_BANNER_IMAGE = "/images/taberna-copas-banner.webp";

// HORARIOS DE EJEMPLO. Cambiá apertura y cierre según el horario real del comercio.
// Índices: 0 domingo, 1 lunes, ... 6 sábado. Usá null si un día está cerrado.
// Se admiten cierres después de medianoche; por ejemplo: apertura "18:00", cierre "02:00".
const HORARIOS: Array<{ apertura: string; cierre: string } | null> = [
  { apertura: "10:00", cierre: "23:00" }, // Domingo
  { apertura: "10:00", cierre: "23:00" }, // Lunes
  { apertura: "10:00", cierre: "23:00" }, // Martes
  { apertura: "10:00", cierre: "23:00" }, // Miércoles
  { apertura: "10:00", cierre: "23:00" }, // Jueves
  { apertura: "10:00", cierre: "23:00" }, // Viernes
  { apertura: "10:00", cierre: "23:00" }, // Sábado
];

const DIAS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];
const ZONA_HORARIA = "America/Argentina/Cordoba";

type EstadoLocal = { abierto: boolean; texto: string };

function minutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function estadoDelLocal(ahora: Date): EstadoLocal {
  // Leemos el día y la hora del local en Argentina, aunque el cliente esté en otra zona horaria.
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ahora);
  const valor = (tipo: string) =>
    Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  const base = Date.UTC(valor("year"), valor("month") - 1, valor("day"));
  const momento = valor("hour") * 60 + valor("minute");

  const franjas: Array<{
    inicio: number;
    fin: number;
    horaApertura: string;
    horaCierre: string;
    dia: number;
  }> = [];
  for (let offset = -1; offset <= 7; offset++) {
    const dia = new Date(base + offset * 86400000).getUTCDay();
    const turno = HORARIOS[dia];
    if (!turno) continue;

    const apertura = minutos(turno.apertura);
    const cierre = minutos(turno.cierre);
    const inicio = offset * 1440 + apertura;
    // La misma hora de apertura/cierre representa 24 horas de atención.
    const fin = offset * 1440 + cierre + (cierre <= apertura ? 1440 : 0);
    franjas.push({
      inicio,
      fin,
      horaApertura: turno.apertura,
      horaCierre: turno.cierre,
      dia,
    });
  }

  const abierto = franjas.find((f) => f.inicio <= momento && momento < f.fin);
  if (abierto)
    return {
      abierto: true,
      texto: `Abierto hasta las ${abierto.horaCierre} hs`,
    };

  const proxima = franjas
    .filter((f) => f.inicio > momento)
    .sort((a, b) => a.inicio - b.inicio)[0];
  if (!proxima) return { abierto: false, texto: "Cerrado por el momento" };

  const diasHastaAbrir = Math.floor(proxima.inicio / 1440);
  const cuando =
    diasHastaAbrir === 0
      ? "hoy"
      : diasHastaAbrir === 1
        ? "mañana"
        : `el ${DIAS[proxima.dia]}`;
  return {
    abierto: false,
    texto: `Cerrado · Abre ${cuando} a las ${proxima.horaApertura} hs`,
  };
}

function Qty({
  value,
  max,
  onChange,
  small = false,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  small?: boolean;
}) {
  return (
    <div className={`qty ${small ? "qty-small" : ""}`}>
      <button
        type="button"
        aria-label="Restar una unidad"
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={16} />
      </button>
      <span aria-live="polite">{value}</span>
      <button
        type="button"
        aria-label="Sumar una unidad"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

export default function Storefront() {
  const [items, setItems] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [mounted, setMounted] = useState(false);
  const [category, setCategory] = useState<string>("Todas");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("destacados");
  const [delivery, setDelivery] = useState<Delivery>("Retiro");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [customer, setCustomer] = useState<Customer>(blank);
  const [notice, setNotice] = useState("");
  const [submitted, setSubmitted] = useState<PreviewOrder | null>(null);
  const [estadoLocal, setEstadoLocal] = useState<EstadoLocal | null>(null);
  const [wholesale, setWholesale] = useState<WholesaleRequest>(wholesaleBlank);
  const [wholesalePreview, setWholesalePreview] = useState<WholesaleRequest | null>(null);
  const [copied, setCopied] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(readCatalog());
    setCart(readCart());
    setMounted(true);
    const reload = () => setItems(readCatalog());
    window.addEventListener("storage", reload);
    window.addEventListener(SYNC_EVENT, reload);
    return () => {
      window.removeEventListener("storage", reload);
      window.removeEventListener(SYNC_EVENT, reload);
    };
  }, []);
  useEffect(() => {
    if (!mounted) return;
    try {
      writeCart(cart);
    } catch {}
  }, [cart, mounted]);
  useEffect(() => {
    if (!sheet && !submitted && !wholesalePreview) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSheet(null);
        setSubmitted(null);
        setWholesalePreview(null);
      }
    };
    window.addEventListener("keydown", fn);
    return () => {
      document.body.style.overflow = old;
      window.removeEventListener("keydown", fn);
    };
  }, [sheet, submitted, wholesalePreview]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const actualizar = () => setEstadoLocal(estadoDelLocal(new Date()));
    actualizar();
    const timer = window.setInterval(actualizar, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("es-AR");
    const list = items.filter(
      (p) =>
        p.active &&
        p.stock > 0 &&
        (category === "Todas" || p.category === category) &&
        `${p.name} ${p.category} ${p.volume}`.toLowerCase().includes(q),
    );
    if (sort === "menor") list.sort((a, b) => a.price - b.price);
    if (sort === "mayor") list.sort((a, b) => b.price - a.price);
    if (sort === "nombre")
      list.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return list;
  }, [items, category, search, sort]);

  const lines = useMemo(
    () =>
      items
        .filter((p) => p.active && (cart[p.id] || 0) > 0)
        .map((product) => ({
          product,
          count: Math.min(cart[product.id], product.stock),
        }))
        .filter((x) => x.count > 0),
    [cart, items],
  );
  const totalQty = lines.reduce((a, b) => a + b.count, 0);
  const total = lines.reduce((a, b) => a + b.count * b.product.price, 0);
  const setQuantity = (p: Product, n: number) =>
    setCart((cur) => {
      const out = { ...cur };
      if (n <= 0) delete out[p.id];
      else out[p.id] = Math.min(99, p.stock, n);
      return out;
    });
  const openSearch = () => {
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => searchRef.current?.focus(), 350);
  };
  const beginCheckout = () => {
    if (totalQty > 0) setSheet("checkout");
  };

  const deliveryChoice = (compact = false) => (
    <div
      className={`delivery-switch ${compact ? "compact" : ""}`}
      role="group"
      aria-label="Modo de entrega"
    >
      <button
        type="button"
        className={delivery === "Retiro" ? "active" : ""}
        onClick={() => setDelivery("Retiro")}
      >
        <Store size={17} /> Retiro en tienda
      </button>
      <button
        type="button"
        className={delivery === "Envío" ? "active" : ""}
        onClick={() => setDelivery("Envío")}
      >
        <Truck size={17} /> Envío
      </button>
    </div>
  );

  function checkout(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (
      !customer.name.trim() ||
      !customer.phone.trim() ||
      !customer.payment ||
      (delivery === "Envío" && !customer.address.trim()) ||
      !customer.age ||
      !lines.length
    ) {
      setNotice("Completá los datos obligatorios para continuar.");
      return;
    }

    // Solo se crea un resumen visual, sin enviar datos ni registrar ventas.
    setSubmitted({
      customer: customer.name.trim(),
      delivery,
      payment: customer.payment,
      items: lines.map(({ product, count }) => ({
        name: product.name,
        quantity: count,
        amount: product.price * count,
      })),
      total,
    });
    setSheet(null);
    setCart({});
    setCustomer(blank);
  }

  function submitWholesale(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!wholesale.business.trim() || !wholesale.name.trim() ||
        !wholesale.phone.trim() || !wholesale.city.trim() ||
        !wholesale.products.trim()) {
      setNotice("Completá los datos para preparar la consulta.");
      return;
    }
    setCopied(false);
    setWholesalePreview({ ...wholesale });
  }

  async function copyWholesale() {
    if (!wholesalePreview) return;
    const content = [
      "CONSULTA MAYORISTA — LA TABERNA BEBIDAS",
      `Negocio: ${wholesalePreview.business}`,
      `Contacto: ${wholesalePreview.name}`,
      `Teléfono: ${wholesalePreview.phone}`,
      `Localidad: ${wholesalePreview.city}`,
      `Entrega: ${wholesalePreview.delivery}`,
      "Productos y cantidades:",
      wholesalePreview.products,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
    } catch {
      setNotice("No se pudo copiar. Podés seleccionar el texto manualmente.");
    }
  }

  return (
    <div className="store-shell">
      <div className="top-bar">
        <span><MapPin size={12} /> General Paz 332 · General Deheza</span>
      </div>
      <header className="main-header">
        <div className="container header-inner">
          <a
            href="#inicio"
            className="brand-wordmark"
            aria-label="La Taberna Bebidas, inicio"
          >
            <strong>
              la taberna<span>.</span>
            </strong>
            <small>BEBIDAS</small>
          </a>
          <nav className="header-links" aria-label="Navegación principal">
            <a href="#catalogo">Bebidas</a>
            <a href="#mayoristas">Mayoristas</a>
            <a href="#ubicacion">Ubicación</a>
            <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer">
              Instagram <Instagram size={16} />
            </a>
          </nav>
          <div className="header-icons">
            <button
              type="button"
              className="bare-icon"
              aria-label="Buscar productos"
              onClick={openSearch}
            >
              <Search size={21} />
            </button>
            <button
              type="button"
              className="bare-icon cart-header-icon"
              aria-label="Abrir carrito"
              onClick={() => setSheet("cart")}
            >
              <ShoppingBag size={21} />
              <b>{totalQty}</b>
            </button>
          </div>
        </div>
      </header>

      <main id="inicio">
        <section className="container taberna-warm-hero" aria-label="La Taberna Bebidas">
          <div
            className="taberna-warm-hero-photo"
            style={{ backgroundImage: `url("${HERO_BANNER_IMAGE}")` }}
            aria-hidden="true"
          />
          <div className="taberna-warm-hero-glaze" aria-hidden="true" />
          <Image
            src="/images/la-taberna-logo.png"
            alt="La Taberna Bebidas"
            width={116}
            height={116}
            priority
            className="taberna-warm-hero-logo"
          />
        </section>

        <div className="container taberna-status-wrap">
          <div
            className={`taberna-status ${estadoLocal?.abierto ? "is-open" : "is-closed"}`}
            role="status"
            aria-live="polite"
          >
            <span className="taberna-status-light" aria-hidden="true" />
            <span>{estadoLocal?.texto ?? "Consultando horarios..."}</span>
          </div>
        </div>

        <section className="catalog-area" id="catalogo">
          <div className="container">
            <div className="catalog-head">
              <div>
                <p className="eyebrow"><Wine size={15} /> LA TABERNA</p>
                <h2>Elegí tus bebidas<span>.</span></h2>
              </div>
              <span className="catalog-count">{visible.length} productos</span>
            </div>
            <div className="catalog-tools">
              <label className="search-input">
                <Search size={21} />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar bebidas, marcas, categorías..."
                  aria-label="Buscar productos"
                />
                {search && (
                  <button
                    aria-label="Borrar búsqueda"
                    type="button"
                    onClick={() => setSearch("")}
                  >
                    <X size={17} />
                  </button>
                )}
              </label>
              <label className="sort-select">
                <SlidersHorizontal size={17} />
                <select
                  aria-label="Ordenar productos"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                >
                  <option value="destacados">Destacados</option>
                  <option value="menor">Menor precio</option>
                  <option value="mayor">Mayor precio</option>
                  <option value="nombre">Nombre A-Z</option>
                </select>
                <ChevronDown size={16} />
              </label>
            </div>
            <div
              className="category-tabs"
              role="group"
              aria-label="Filtrar categoría"
            >
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  className={c === category ? "current" : ""}
                  key={c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            {visible.length ? (
              <div className="product-grid">
                {visible.map((product, index) => (
                  <article className="product-card" key={product.id}>
                    <div className="product-art">
                      <Image
                        src={product.image || "/images/placeholder.svg"}
                        alt={product.name}
                        width={440}
                        height={440}
                        loading={index < 2 ? "eager" : "lazy"}
                        unoptimized={product.image?.startsWith("data:")}
                      />
                      {product.badge && (
                        <span className="product-badge">{product.badge}</span>
                      )}
                    </div>
                    <div className="product-info">
                      <span className="product-category">
                        {product.category} · {product.volume}
                      </span>
                      <h3>{product.name}</h3>
                      <div className="product-bottom">
                        <strong>{money(product.price)}</strong>
                        <Qty
                          value={Math.min(cart[product.id] || 0, product.stock)}
                          max={Math.min(99, product.stock)}
                          onChange={(n) => setQuantity(product, n)}
                        />
                      </div>
                      <small className="product-stock">
                        {(cart[product.id] || 0) > 0 ? (
                          <>
                            <Check size={13} /> En tu carrito
                          </>
                        ) : product.stock <= 5 ? (
                          `Últimas ${product.stock} unidades`
                        ) : (
                          "Disponible"
                        )}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-catalog">
                <Search size={36} />
                <h3>No encontramos bebidas</h3>
                <p>Probá otra búsqueda o categoría.</p>
                <button
                  type="button"
                  className="btn btn-dark"
                  onClick={() => {
                    setSearch("");
                    setCategory("Todas");
                  }}
                >
                  Ver todo el catálogo
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="container taberna-bottom-grid" id="mayoristas">
          <div className="taberna-wholesale-panel">
            <p className="taberna-section-kicker"><Building2 size={16} /> PARA COMERCIOS</p>
            <h2>Pedidos mayoristas</h2>
            <p className="taberna-section-subtitle">Contanos qué bebidas necesitás y en qué cantidad.</p>

            <form className="taberna-wholesale-form" onSubmit={submitWholesale}>
              <div className="taberna-field-grid">
                <label>
                  Comercio o razón social *
                  <input
                    value={wholesale.business}
                    onChange={(e) => setWholesale((p) => ({ ...p, business: e.target.value }))}
                    placeholder="Nombre del comercio"
                    autoComplete="organization"
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  Nombre de contacto *
                  <input
                    value={wholesale.name}
                    onChange={(e) => setWholesale((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Tu nombre"
                    autoComplete="name"
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  Teléfono *
                  <input
                    type="tel"
                    value={wholesale.phone}
                    onChange={(e) => setWholesale((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="Código de área y número"
                    autoComplete="tel"
                    required
                    maxLength={40}
                  />
                </label>
                <label>
                  Localidad *
                  <input
                    value={wholesale.city}
                    onChange={(e) => setWholesale((p) => ({ ...p, city: e.target.value }))}
                    placeholder="Ciudad o localidad"
                    required
                    maxLength={100}
                  />
                </label>
              </div>
              <label>
                Productos y cantidades *
                <textarea
                  rows={4}
                  value={wholesale.products}
                  onChange={(e) => setWholesale((p) => ({ ...p, products: e.target.value }))}
                  placeholder="Ej.: 12 cajas de cerveza, 6 botellas de fernet..."
                  required
                  maxLength={2000}
                />
              </label>
              <label>
                Entrega
                <select
                  value={wholesale.delivery}
                  onChange={(e) => setWholesale((p) => ({ ...p, delivery: e.target.value }))}
                >
                  <option>Retiro en el local</option>
                  <option>Necesito envío</option>
                  <option>A coordinar</option>
                </select>
              </label>
              <button type="submit" className="taberna-warm-action">
                Preparar consulta <ArrowRight size={17} />
              </button>
              <small>Vista previa: todavía no se envía la solicitud al negocio.</small>
            </form>
          </div>

          <div className="taberna-location-panel" id="ubicacion">
            <p className="taberna-section-kicker"><MapPinned size={16} /> VISITANOS</p>
            <h2>Estamos acá</h2>
            <p className="taberna-section-subtitle">General Paz 332 · General Deheza, Córdoba</p>
            <div className="taberna-map-frame">
              <iframe
                title="Mapa de ubicación de La Taberna Bebidas en General Paz 332, General Deheza"
                src={MAP_EMBED_URL}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
            <a href={MAP_SEARCH_URL} target="_blank" rel="noopener noreferrer" className="taberna-map-link">
              Ver cómo llegar <ArrowRight size={16} />
            </a>
          </div>
        </section>
      </main>

      <footer className="footer taberna-minimal-footer">
        <div className="container taberna-footer-row">
          <span>La Taberna Bebidas · General Deheza</span>
          <div>
            <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer">
              <Instagram size={16} /> Instagram
            </a>
            <Link href="/admin">Administración</Link>
          </div>
        </div>
        <div className="container taberna-footer-disclaimer">
          Venta exclusiva a mayores de 18 años · Precios sujetos a confirmación.
        </div>
      </footer>

      {wholesalePreview && (
        <div className="overlay" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setWholesalePreview(null);
        }}>
          <div className="taberna-wholesale-modal" role="dialog" aria-modal="true" aria-labelledby="wholesale-title">
            <button type="button" className="taberna-wholesale-close" aria-label="Cerrar" onClick={() => setWholesalePreview(null)}>
              <X size={21} />
            </button>
            <div className="taberna-wholesale-ok"><CheckCircle2 size={33} /></div>
            <h2 id="wholesale-title">Consulta preparada</h2>
            <p>Este es el resumen de tu consulta mayorista.</p>
            <div className="taberna-wholesale-summary">
              <strong>{wholesalePreview.business}</strong>
              <span>{wholesalePreview.name} · {wholesalePreview.phone}</span>
              <span>{wholesalePreview.city} · {wholesalePreview.delivery}</span>
              <p>{wholesalePreview.products}</p>
            </div>
            <button type="button" className="taberna-warm-action" onClick={copyWholesale}>
              {copied ? <Check size={17} /> : <Copy size={17} />}
              {copied ? "Consulta copiada" : "Copiar consulta"}
            </button>
            <small>No se enviaron datos ni se registró un pedido. Es una vista previa.</small>
          </div>
        </div>
      )}

      {totalQty > 0 && !sheet && (
        <button
          className="sticky-cart"
          type="button"
          onClick={() => setSheet("cart")}
        >
          <span className="sticky-count">{totalQty}</span>
          <ShoppingBag size={19} />
          <span>Ver mi pedido</span>
          <strong>{money(total)}</strong>
          <ArrowRight size={20} />
        </button>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}

      {submitted && (
        <div
          className="overlay success-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSubmitted(null);
          }}
        >
          <div
            className="success-card taberna-preview-success"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-success-title"
          >
            <button
              type="button"
              aria-label="Cerrar confirmación"
              className="preview-close"
              onClick={() => setSubmitted(null)}
            >
              <X size={19} />
            </button>

            <div className="preview-illustration" aria-hidden="true">
              <span className="preview-emoji preview-emoji-1">🍸</span>
              <span className="preview-emoji preview-emoji-2">🥂</span>
              <span className="preview-emoji preview-emoji-3">🍷</span>
              <span className="preview-emoji preview-emoji-4">🍾</span>
              <div className="preview-check">
                <CheckCircle2 size={42} strokeWidth={1.8} />
              </div>
            </div>

            <p className="eyebrow">LA TABERNA BEBIDAS · VISTA PREVIA</p>
            <h2 id="preview-success-title">¡Pedido simulado!</h2>
            <p>
              {submitted.customer}, así se vería la confirmación de tu compra.
              <strong>
                {" "}
                No se envió ningún pedido ni se realizó ningún pago.
              </strong>
            </p>

            <div className="preview-summary">
              <div className="preview-summary-top">
                <strong>Resumen del pedido</strong>
                <span>
                  {submitted.delivery} · {submitted.payment}
                </span>
              </div>
              <div className="preview-summary-items">
                {submitted.items.map((item, index) => (
                  <div key={`${item.name}-${index}`}>
                    <span>
                      {item.quantity} × {item.name}
                    </span>
                    <strong>{money(item.amount)}</strong>
                  </div>
                ))}
              </div>
              <div className="preview-summary-total">
                <span>Total</span>
                <strong>{money(submitted.total)}</strong>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-dark preview-action"
              onClick={() => setSubmitted(null)}
            >
              Seguir explorando <ArrowRight size={18} />
            </button>

            <style jsx>{`
              .taberna-preview-success {
                width: min(450px, calc(100% - 28px));
                position: relative;
                overflow-y: auto;
                max-height: calc(100dvh - 36px);
                border: 1px solid #dde7f2;
                padding: 30px 29px 28px;
                box-shadow: 0 28px 85px rgba(2, 17, 35, 0.28);
                animation: previewAppear 0.32s cubic-bezier(0.2, 0.8, 0.25, 1)
                  both;
              }
              .taberna-preview-success::before {
                content: "";
                position: absolute;
                left: 0;
                right: 0;
                top: 0;
                height: 5px;
                background: linear-gradient(90deg, #0e243f, #3e79b9, #0e243f);
              }
              .preview-close {
                position: absolute;
                top: 15px;
                right: 16px;
                width: 32px;
                height: 32px;
                display: grid;
                place-items: center;
                border: 1px solid #e0e8f1;
                background: #fff;
                color: #37516d;
                border-radius: 50%;
                cursor: pointer;
                z-index: 3;
              }
              .preview-illustration {
                width: 192px;
                height: 119px;
                position: relative;
                margin: 0 auto 8px;
              }
              .preview-check {
                position: absolute;
                top: 28px;
                left: 66px;
                width: 63px;
                height: 63px;
                border-radius: 50%;
                display: grid;
                place-items: center;
                color: #1c6652;
                background: radial-gradient(
                  circle at 40% 30%,
                  #f7fffd,
                  #e9f5ef
                );
                border: 1px solid #d6e8df;
                box-shadow: 0 6px 20px rgba(11, 83, 62, 0.1);
                z-index: 2;
                animation: previewCheck 0.55s
                  cubic-bezier(0.25, 0.85, 0.3, 1.15) 0.1s both;
              }
              .preview-emoji {
                position: absolute;
                display: inline-block;
                font-size: 28px;
                line-height: 1;
                filter: drop-shadow(0 4px 6px rgba(12, 28, 47, 0.09));
                animation: previewFloat 3s ease-in-out infinite;
                user-select: none;
              }
              .preview-emoji-1 {
                left: 10px;
                top: 26px;
                transform: rotate(-12deg);
                animation-delay: 0s;
              }
              .preview-emoji-2 {
                right: 8px;
                top: 17px;
                animation-delay: -0.8s;
              }
              .preview-emoji-3 {
                left: 28px;
                bottom: 6px;
                font-size: 25px;
                animation-delay: -1.4s;
              }
              .preview-emoji-4 {
                right: 30px;
                bottom: 5px;
                font-size: 25px;
                animation-delay: -2s;
              }
              .preview-summary {
                border: 1px solid #e3eaf2;
                background: #f5f8fc;
                padding: 16px;
                text-align: left;
                border-radius: 13px;
                margin: 3px 0 18px;
              }
              .preview-summary-top {
                display: flex;
                justify-content: space-between;
                align-items: start;
                gap: 8px;
                padding-bottom: 11px;
                border-bottom: 1px solid #e0e8f1;
              }
              .preview-summary-top strong {
                color: #102440;
                font-size: 12px;
              }
              .preview-summary-top span {
                font-size: 10px;
                color: #667c94;
                text-align: right;
              }
              .preview-summary-items {
                padding: 8px 0;
                max-height: 112px;
                overflow: auto;
              }
              .preview-summary-items div {
                display: flex;
                justify-content: space-between;
                gap: 9px;
                padding: 5px 0;
                color: #526a84;
                font-size: 11px;
              }
              .preview-summary-items strong {
                color: #102440;
                white-space: nowrap;
              }
              .preview-summary-total {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-top: 1px solid #e0e8f1;
                padding-top: 11px;
                font-size: 12px;
                font-weight: 800;
                color: #102440;
              }
              .preview-summary-total strong {
                font-size: 20px;
              }
              .preview-action {
                width: 100%;
                justify-content: center;
              }
              @keyframes previewAppear {
                from {
                  opacity: 0;
                  transform: translateY(14px) scale(0.97);
                }
                to {
                  opacity: 1;
                  transform: translateY(0) scale(1);
                }
              }
              @keyframes previewFloat {
                0%,
                100% {
                  translate: 0 0;
                }
                50% {
                  translate: 0 -9px;
                }
              }
              @keyframes previewCheck {
                from {
                  opacity: 0;
                  transform: scale(0.65);
                }
                to {
                  opacity: 1;
                  transform: scale(1);
                }
              }
              @media (max-width: 420px) {
                .taberna-preview-success {
                  padding: 23px 19px 19px;
                }
                .preview-illustration {
                  height: 103px;
                }
              }
              @media (prefers-reduced-motion: reduce) {
                .taberna-preview-success,
                .preview-emoji,
                .preview-check {
                  animation: none !important;
                }
              }
            `}</style>
          </div>
        </div>
      )}

      {sheet && (
        <div
          className="overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSheet(null);
          }}
        >
          <aside
            className="order-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={sheet === "cart" ? "Mi pedido" : "Finalizar pedido"}
          >
            <div className="sheet-head">
              <div>
                <p className="eyebrow">LA TABERNA · TU SELECCIÓN</p>
                <h2>{sheet === "cart" ? "Mi pedido." : "Finalizar pedido."}</h2>
              </div>
              <button
                className="close-btn"
                type="button"
                aria-label="Cerrar"
                onClick={() => setSheet(null)}
              >
                <X size={22} />
              </button>
            </div>
            {sheet === "cart" ? (
              <>
                <div className="sheet-scroll">
                  <div className="sheet-top-note">
                    <ShoppingBag size={18} /> Revisá tu selección antes de
                    continuar.
                  </div>
                  {lines.length ? (
                    lines.map(({ product, count }) => (
                      <div className="cart-line" key={product.id}>
                        <div className="cart-image">
                          <Image
                            src={product.image || "/images/placeholder.svg"}
                            alt={product.name}
                            width={95}
                            height={95}
                            unoptimized={product.image?.startsWith("data:")}
                          />
                        </div>
                        <div className="cart-details">
                          <strong>{product.name}</strong>
                          <small>{product.volume}</small>
                          <Qty
                            small
                            value={count}
                            max={Math.min(99, product.stock)}
                            onChange={(n) => setQuantity(product, n)}
                          />
                        </div>
                        <div className="cart-line-end">
                          <strong>{money(product.price * count)}</strong>
                          <button
                            type="button"
                            aria-label={`Quitar ${product.name}`}
                            onClick={() => setQuantity(product, 0)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-cart">
                      <ShoppingBag size={36} />
                      <h3>Tu carrito está vacío</h3>
                      <p>Elegí tus bebidas favoritas y armá el pedido.</p>
                      <button
                        className="btn btn-dark"
                        type="button"
                        onClick={() => setSheet(null)}
                      >
                        Explorar catálogo
                      </button>
                    </div>
                  )}
                </div>
                <div className="sheet-footer">
                  <div className="footer-total">
                    <span>
                      Total productos <small>{totalQty} unidades</small>
                    </span>
                    <strong>{money(total)}</strong>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary full"
                    disabled={!lines.length}
                    onClick={beginCheckout}
                  >
                    Continuar pedido <ArrowRight size={18} />
                  </button>
                  <p>Probá el recorrido del pedido, sin envío ni pago real.</p>
                </div>
              </>
            ) : (
              <>
                <form
                  className="checkout-form"
                  id="taberna-checkout"
                  onSubmit={checkout}
                >
                  <div className="checkout-back">
                    <button type="button" onClick={() => setSheet("cart")}>
                      <ArrowLeft size={16} /> Volver al carrito
                    </button>
                  </div>
                  <div className="form-section">
                    <h3>
                      <span>01</span> Tus datos
                    </h3>
                    <label>
                      Nombre y apellido *
                      <input
                        required
                        value={customer.name}
                        onChange={(e) =>
                          setCustomer((c) => ({ ...c, name: e.target.value }))
                        }
                        placeholder="Tu nombre"
                      />
                    </label>
                    <label>
                      Teléfono *
                      <input
                        required
                        inputMode="tel"
                        value={customer.phone}
                        onChange={(e) =>
                          setCustomer((c) => ({ ...c, phone: e.target.value }))
                        }
                        placeholder="Ej. 358 555 1234"
                      />
                    </label>
                  </div>
                  <div className="form-section">
                    <h3>
                      <span>02</span> Entrega
                    </h3>
                    {deliveryChoice(true)}
                    {delivery === "Envío" && (
                      <label className="address-field">
                        Dirección de entrega *
                        <input
                          required
                          value={customer.address}
                          onChange={(e) =>
                            setCustomer((c) => ({
                              ...c,
                              address: e.target.value,
                            }))
                          }
                          placeholder="Localidad, calle y número"
                        />
                      </label>
                    )}
                  </div>
                  <div className="form-section">
                    <h3>
                      <span>03</span> Forma de pago
                    </h3>
                    <div className="payment-choices">
                      {["Efectivo", "Transferencia", "Mercado Pago"].map(
                        (method) => (
                          <button
                            type="button"
                            key={method}
                            className={
                              customer.payment === method ? "chosen" : ""
                            }
                            onClick={() =>
                              setCustomer((c) => ({ ...c, payment: method }))
                            }
                          >
                            <Wallet size={17} />
                            {method}
                            {customer.payment === method && <Check size={15} />}
                          </button>
                        ),
                      )}
                    </div>
                    <small>
                      Elegí una opción para ver cómo quedaría el pedido. No se
                      realiza ningún cobro.
                    </small>
                  </div>
                  <div className="form-section">
                    <label>
                      Aclaraciones (opcional)
                      <textarea
                        rows={3}
                        placeholder="Indicaciones o consultas sobre tu pedido..."
                        value={customer.notes}
                        onChange={(e) =>
                          setCustomer((c) => ({ ...c, notes: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <div className="summary-box">
                    <h3>Resumen del pedido</h3>
                    {lines.map(({ product, count }) => (
                      <div key={product.id}>
                        <span>
                          {count} × {product.name}
                        </span>
                        <strong>{money(product.price * count)}</strong>
                      </div>
                    ))}
                    <div className="summary-total">
                      <strong>Total</strong>
                      <strong>{money(total)}</strong>
                    </div>
                  </div>
                  <label className="age-check">
                    <input
                      type="checkbox"
                      required
                      checked={customer.age}
                      onChange={(e) =>
                        setCustomer((c) => ({ ...c, age: e.target.checked }))
                      }
                    />
                    <span>Confirmo que soy mayor de 18 años.</span>
                  </label>
                </form>
                <div className="sheet-footer">
                  <div className="footer-total">
                    <span>Total del pedido</span>
                    <strong>{money(total)}</strong>
                  </div>
                  <button
                    className="btn btn-primary full"
                    type="submit"
                    form="taberna-checkout"
                    disabled={!lines.length}
                  >
                    Simular pedido <ArrowRight size={18} />
                  </button>
                  <p>
                    Vista previa: no se enviará el pedido ni se realizará ningún
                    pago.
                  </p>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
