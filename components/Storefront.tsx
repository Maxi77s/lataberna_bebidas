"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Instagram, MapPin, Minus, Plus, Search, ShoppingBag, SlidersHorizontal, Store, Trash2, Truck, Wallet, Wine, X } from "lucide-react";
import { CATEGORIES, INITIAL_PRODUCTS, money, type Product } from "@/data/catalog";
import { SYNC_EVENT, readCart, readCatalog, writeCart } from "@/lib/storage";

type Sheet = "cart" | "checkout" | null;
type Delivery = "Retiro" | "Envío";
type Sort = "destacados" | "menor" | "mayor" | "nombre";
type Customer = { name: string; phone: string; address: string; payment: string; notes: string; age: boolean };
type PreviewOrder = {
  customer: string;
  delivery: Delivery;
  payment: string;
  total: number;
  items: { name: string; quantity: number; amount: number }[];
};

const blank: Customer = { name: "", phone: "", address: "", payment: "", notes: "", age: false };
const INSTAGRAM = "https://www.instagram.com/lataberna_bebidas/";

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

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
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
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(ahora);
  const valor = (tipo: string) => Number(partes.find(p => p.type === tipo)?.value ?? 0);
  const base = Date.UTC(valor("year"), valor("month") - 1, valor("day"));
  const momento = valor("hour") * 60 + valor("minute");

  const franjas: Array<{ inicio: number; fin: number; horaApertura: string; horaCierre: string; dia: number }> = [];
  for (let offset = -1; offset <= 7; offset++) {
    const dia = new Date(base + offset * 86400000).getUTCDay();
    const turno = HORARIOS[dia];
    if (!turno) continue;

    const apertura = minutos(turno.apertura);
    const cierre = minutos(turno.cierre);
    const inicio = offset * 1440 + apertura;
    // La misma hora de apertura/cierre representa 24 horas de atención.
    const fin = offset * 1440 + cierre + (cierre <= apertura ? 1440 : 0);
    franjas.push({ inicio, fin, horaApertura: turno.apertura, horaCierre: turno.cierre, dia });
  }

  const abierto = franjas.find(f => f.inicio <= momento && momento < f.fin);
  if (abierto) return { abierto: true, texto: `Abierto hasta las ${abierto.horaCierre} hs` };

  const proxima = franjas.filter(f => f.inicio > momento).sort((a, b) => a.inicio - b.inicio)[0];
  if (!proxima) return { abierto: false, texto: "Cerrado por el momento" };

  const diasHastaAbrir = Math.floor(proxima.inicio / 1440);
  const cuando = diasHastaAbrir === 0 ? "hoy" : diasHastaAbrir === 1 ? "mañana" : `el ${DIAS[proxima.dia]}`;
  return { abierto: false, texto: `Cerrado · Abre ${cuando} a las ${proxima.horaApertura} hs` };
}

function Qty({ value, max, onChange, small = false }: { value: number; max: number; onChange: (n: number) => void; small?: boolean }) {
  return <div className={`qty ${small ? "qty-small" : ""}`}>
    <button type="button" aria-label="Restar una unidad" disabled={value <= 0} onClick={() => onChange(value - 1)}><Minus size={16}/></button>
    <span aria-live="polite">{value}</span>
    <button type="button" aria-label="Sumar una unidad" disabled={value >= max} onClick={() => onChange(value + 1)}><Plus size={16}/></button>
  </div>;
}

export default function Storefront() {
  const [items, setItems] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<Record<string,number>>({});
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
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setItems(readCatalog()); setCart(readCart()); setMounted(true);
    const reload = () => setItems(readCatalog());
    window.addEventListener("storage", reload); window.addEventListener(SYNC_EVENT, reload);
    return () => {window.removeEventListener("storage", reload);window.removeEventListener(SYNC_EVENT, reload);};
  }, []);
  useEffect(() => { if (!mounted) return; try { writeCart(cart); } catch {} }, [cart,mounted]);
  useEffect(() => {
    if (!sheet && !submitted) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSheet(null);
        setSubmitted(null);
      }
    };
    window.addEventListener("keydown", fn);
    return () => {
      document.body.style.overflow = old;
      window.removeEventListener("keydown", fn);
    };
  }, [sheet, submitted]);
  useEffect(() => { if (!notice) return; const t = setTimeout(()=>setNotice(""),3000); return ()=>clearTimeout(t); },[notice]);
  useEffect(() => {
    const actualizar = () => setEstadoLocal(estadoDelLocal(new Date()));
    actualizar();
    const timer = window.setInterval(actualizar, 30000);
    return () => window.clearInterval(timer);
  }, []);


  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("es-AR");
    const list = items.filter(p => p.active && p.stock > 0 && (category === "Todas" || p.category === category) && `${p.name} ${p.category} ${p.volume}`.toLowerCase().includes(q));
    if (sort === "menor") list.sort((a,b)=>a.price-b.price);
    if (sort === "mayor") list.sort((a,b)=>b.price-a.price);
    if (sort === "nombre") list.sort((a,b)=>a.name.localeCompare(b.name,"es"));
    return list;
  },[items,category,search,sort]);

  const lines = useMemo(() => items.filter(p=>p.active && (cart[p.id]||0)>0).map(product=>({product, count: Math.min(cart[product.id],product.stock)})).filter(x=>x.count>0),[cart,items]);
  const totalQty = lines.reduce((a,b)=>a+b.count,0);
  const total = lines.reduce((a,b)=>a+b.count*b.product.price,0);
  const setQuantity = (p: Product,n:number) => setCart(cur=>{const out={...cur}; if(n<=0) delete out[p.id]; else out[p.id]=Math.min(99,p.stock,n); return out;});
  const openSearch = () => {document.getElementById("catalogo")?.scrollIntoView({behavior:"smooth"});window.setTimeout(()=>searchRef.current?.focus(),350);};
  const beginCheckout = () => {if(totalQty>0)setSheet("checkout");};

  const deliveryChoice = (compact=false) => <div className={`delivery-switch ${compact ? "compact" : ""}`} role="group" aria-label="Modo de entrega">
      <button type="button" className={delivery === "Retiro"?"active":""} onClick={()=>setDelivery("Retiro")}><Store size={17}/> Retiro en tienda</button>
      <button type="button" className={delivery === "Envío"?"active":""} onClick={()=>setDelivery("Envío")}><Truck size={17}/> Envío</button>
    </div>;

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

  return <div className="store-shell">
    <div className="top-bar"><span><MapPin size={12}/> General Deheza, Córdoba</span><span>Catálogo online</span></div>
    <header className="main-header">
      <div className="container header-inner">
        <a href="#inicio" className="brand-wordmark" aria-label="La Taberna Bebidas, inicio"><strong>la taberna<span>.</span></strong><small>BEBIDAS</small></a>
        <nav className="header-links" aria-label="Navegación principal"><a href="#catalogo">Catálogo</a><a href="#contacto">Contacto</a><a href={INSTAGRAM} target="_blank" rel="noopener noreferrer">Instagram <Instagram size={16}/></a></nav>
        <div className="header-icons"><button type="button" className="bare-icon" aria-label="Buscar productos" onClick={openSearch}><Search size={21}/></button><button type="button" className="bare-icon cart-header-icon" aria-label="Abrir carrito" onClick={()=>setSheet("cart")}><ShoppingBag size={21}/><b>{totalQty}</b></button></div>
      </div>
    </header>

    <main id="inicio">
      <section
        className="container"
        aria-label="La Taberna Bebidas"
        style={{
          position: "relative",
          height: "clamp(132px, 18vw, 180px)",
          marginTop: 12,
          marginBottom: 0,
          borderRadius: 14,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(110deg, rgba(9, 25, 47, 0.88), rgba(29, 79, 135, 0.68))",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: "1px solid rgba(72, 132, 195, 0.20)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)",
        }}
      >
        <Image
          src="/images/la-taberna-logo.png"
          alt="La Taberna Bebidas"
          width={108}
          height={108}
          priority
          style={{
            display: "block",
            width: "clamp(84px, 11vw, 108px)",
            height: "auto",
            aspectRatio: "1 / 1",
            objectFit: "contain",
            borderRadius: "50%",
            boxShadow: "0 7px 20px rgba(0,0,0,0.20)",
          }}
        />
      </section>

      <div className="container" style={{ display: "flex", justifyContent: "center", marginTop: 14, marginBottom: 18 }}>
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "#fff", border: "1px solid #e1e7ef",
            borderRadius: 999, padding: "10px 16px", color: "#21344c",
            fontSize: 12, fontWeight: 700,
            boxShadow: "0 4px 14px rgba(12,35,61,.04)",
            maxWidth: "100%", textAlign: "center",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 10, height: 10, flexShrink: 0,
              borderRadius: "50%",
              background: estadoLocal?.abierto ? "#18a35f" : "#a7b0bc",
              boxShadow: estadoLocal?.abierto ? "0 0 0 4px rgba(24,163,95,.13)" : "none",
            }}
          />
          {estadoLocal?.texto ?? "Consultando horario..."}
        </div>
      </div>

      <section className="catalog-area" id="catalogo">
        <div className="container">
          <div className="catalog-head"><div><p className="eyebrow"><Wine size={16}/> NUESTRO CATÁLOGO</p><h2>Elegí tus <span>bebidas.</span></h2><p>Encontrá lo que necesitás para tu próxima ocasión.</p></div><span className="catalog-count">{visible.length} productos</span></div>
          <div className="catalog-tools"><label className="search-input"><Search size={21}/><input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar bebidas, marcas, categorías..." aria-label="Buscar productos"/>{search && <button aria-label="Borrar búsqueda" type="button" onClick={()=>setSearch("")}><X size={17}/></button>}</label>
            <label className="sort-select"><SlidersHorizontal size={17}/><select aria-label="Ordenar productos" value={sort} onChange={e=>setSort(e.target.value as Sort)}><option value="destacados">Destacados</option><option value="menor">Menor precio</option><option value="mayor">Mayor precio</option><option value="nombre">Nombre A-Z</option></select><ChevronDown size={16}/></label></div>
          <div className="category-tabs" role="group" aria-label="Filtrar categoría">{CATEGORIES.map(c=><button type="button" className={c===category?"current":""} key={c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
          {visible.length ? <div className="product-grid">{visible.map(product=><article className="product-card" key={product.id}>
            <div className="product-art"><Image src={product.image||"/images/placeholder.svg"} alt={product.name} width={440} height={440} unoptimized={product.image?.startsWith("data:")} />{product.badge && <span className="product-badge">{product.badge}</span>}</div>
            <div className="product-info"><span className="product-category">{product.category} · {product.volume}</span><h3>{product.name}</h3><p className="product-description">{product.description}</p><div className="product-bottom"><strong>{money(product.price)}</strong><Qty value={Math.min(cart[product.id]||0,product.stock)} max={Math.min(99,product.stock)} onChange={n=>setQuantity(product,n)}/></div>
              <small className="product-stock">{(cart[product.id]||0)>0 ? <><Check size={13}/> En tu carrito</> : product.stock<=5 ? `Últimas ${product.stock} unidades` : "Disponible"}</small></div>
          </article>)}</div> : <div className="empty-catalog"><Search size={36}/><h3>No encontramos bebidas</h3><p>Probá otra búsqueda o categoría.</p><button type="button" className="btn btn-dark" onClick={()=>{setSearch("");setCategory("Todas");}}>Ver todo el catálogo</button></div>}
        </div>
      </section>

      <section className="contact-banner container" id="contacto">
        <div>
          <p className="eyebrow-light">UNA FORMA SIMPLE DE COMPRAR</p>
          <h2>Tu catálogo, siempre a mano.</h2>
          <p>Explorá las bebidas y probá cómo se realiza un pedido desde la web.</p>
        </div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 9,
          border: "1px solid rgba(255,255,255,.28)", borderRadius: 10,
          padding: "13px 18px", color: "#e9f0fa", fontWeight: 700,
          fontSize: 12, whiteSpace: "nowrap",
        }}>
          <Wine size={17} /> Vista previa
        </span>
      </section>
    </main>
    <footer className="footer"><div className="container footer-inner"><div className="footer-brand"><strong>la taberna.</strong><small>BEBIDAS</small><p>General Paz 332 · General Deheza, Córdoba</p></div><div className="footer-social"><a href={INSTAGRAM} target="_blank" rel="noopener noreferrer"><Instagram size={17}/> Instagram</a><Link href="/admin">Administración</Link></div></div><div className="container foot-note">Venta exclusiva a mayores de 18 años. Precios y disponibilidad sujetos a confirmación.</div></footer>

    {totalQty>0 && !sheet && <button className="sticky-cart" type="button" onClick={()=>setSheet("cart")}><span className="sticky-count">{totalQty}</span><ShoppingBag size={19}/><span>Ver mi pedido</span><strong>{money(total)}</strong><ArrowRight size={20}/></button>}
    {notice && <div className="toast" role="status">{notice}</div>}

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
            <div className="preview-check"><CheckCircle2 size={42} strokeWidth={1.8}/></div>
          </div>

          <p className="eyebrow">LA TABERNA BEBIDAS · VISTA PREVIA</p>
          <h2 id="preview-success-title">¡Pedido simulado!</h2>
          <p>
            {submitted.customer}, así se vería la confirmación de tu compra.
            <strong> No se envió ningún pedido ni se realizó ningún pago.</strong>
          </p>

          <div className="preview-summary">
            <div className="preview-summary-top">
              <strong>Resumen del pedido</strong>
              <span>{submitted.delivery} · {submitted.payment}</span>
            </div>
            <div className="preview-summary-items">
              {submitted.items.map((item, index) => (
                <div key={`${item.name}-${index}`}>
                  <span>{item.quantity} × {item.name}</span>
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
              box-shadow: 0 28px 85px rgba(2, 17, 35, .28);
              animation: previewAppear .32s cubic-bezier(.2,.8,.25,1) both;
            }
            .taberna-preview-success::before {
              content: "";
              position: absolute;
              left: 0; right: 0; top: 0; height: 5px;
              background: linear-gradient(90deg, #0e243f, #3e79b9, #0e243f);
            }
            .preview-close {
              position: absolute;
              top: 15px; right: 16px;
              width: 32px; height: 32px;
              display: grid; place-items: center;
              border: 1px solid #e0e8f1;
              background: #fff; color: #37516d;
              border-radius: 50%; cursor: pointer;
              z-index: 3;
            }
            .preview-illustration {
              width: 192px; height: 119px;
              position: relative;
              margin: 0 auto 8px;
            }
            .preview-check {
              position: absolute;
              top: 28px; left: 66px;
              width: 63px; height: 63px;
              border-radius: 50%;
              display: grid; place-items: center;
              color: #1c6652;
              background: radial-gradient(circle at 40% 30%, #f7fffd, #e9f5ef);
              border: 1px solid #d6e8df;
              box-shadow: 0 6px 20px rgba(11, 83, 62, .10);
              z-index: 2;
              animation: previewCheck .55s cubic-bezier(.25,.85,.3,1.15) .1s both;
            }
            .preview-emoji {
              position: absolute;
              display: inline-block;
              font-size: 28px;
              line-height: 1;
              filter: drop-shadow(0 4px 6px rgba(12,28,47,.09));
              animation: previewFloat 3s ease-in-out infinite;
              user-select: none;
            }
            .preview-emoji-1 { left: 10px; top: 26px; transform: rotate(-12deg); animation-delay: 0s; }
            .preview-emoji-2 { right: 8px; top: 17px; animation-delay: -.8s; }
            .preview-emoji-3 { left: 28px; bottom: 6px; font-size: 25px; animation-delay: -1.4s; }
            .preview-emoji-4 { right: 30px; bottom: 5px; font-size: 25px; animation-delay: -2s; }
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
            .preview-summary-top strong { color: #102440; font-size: 12px; }
            .preview-summary-top span { font-size: 10px; color: #667c94; text-align: right; }
            .preview-summary-items { padding: 8px 0; max-height: 112px; overflow: auto; }
            .preview-summary-items div {
              display: flex;
              justify-content: space-between;
              gap: 9px;
              padding: 5px 0;
              color: #526a84;
              font-size: 11px;
            }
            .preview-summary-items strong { color: #102440; white-space: nowrap; }
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
            .preview-summary-total strong { font-size: 20px; }
            .preview-action { width: 100%; justify-content: center; }
            @keyframes previewAppear {
              from { opacity: 0; transform: translateY(14px) scale(.97); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes previewFloat {
              0%, 100% { translate: 0 0; }
              50% { translate: 0 -9px; }
            }
            @keyframes previewCheck {
              from { opacity: 0; transform: scale(.65); }
              to { opacity: 1; transform: scale(1); }
            }
            @media (max-width: 420px) {
              .taberna-preview-success { padding: 23px 19px 19px; }
              .preview-illustration { height: 103px; }
            }
            @media (prefers-reduced-motion: reduce) {
              .taberna-preview-success, .preview-emoji, .preview-check {
                animation: none !important;
              }
            }
          `}</style>
        </div>
      </div>
    )}

    {sheet && <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSheet(null);}}><aside className="order-sheet" role="dialog" aria-modal="true" aria-label={sheet==="cart"?"Mi pedido":"Finalizar pedido"}>
      <div className="sheet-head"><div><p className="eyebrow">LA TABERNA · TU SELECCIÓN</p><h2>{sheet === "cart"?"Mi pedido.":"Finalizar pedido."}</h2></div><button className="close-btn" type="button" aria-label="Cerrar" onClick={()=>setSheet(null)}><X size={22}/></button></div>
      {sheet==="cart" ? <><div className="sheet-scroll"><div className="sheet-top-note"><ShoppingBag size={18}/> Revisá tu selección antes de continuar.</div>{lines.length ? lines.map(({product,count})=><div className="cart-line" key={product.id}><div className="cart-image"><Image src={product.image||"/images/placeholder.svg"} alt={product.name} width={95} height={95} unoptimized={product.image?.startsWith("data:")}/></div><div className="cart-details"><strong>{product.name}</strong><small>{product.volume}</small><Qty small value={count} max={Math.min(99,product.stock)} onChange={n=>setQuantity(product,n)}/></div><div className="cart-line-end"><strong>{money(product.price*count)}</strong><button type="button" aria-label={`Quitar ${product.name}`} onClick={()=>setQuantity(product,0)}><Trash2 size={17}/></button></div></div>) : <div className="empty-cart"><ShoppingBag size={36}/><h3>Tu carrito está vacío</h3><p>Elegí tus bebidas favoritas y armá el pedido.</p><button className="btn btn-dark" type="button" onClick={()=>setSheet(null)}>Explorar catálogo</button></div>}</div>
        <div className="sheet-footer"><div className="footer-total"><span>Total productos <small>{totalQty} unidades</small></span><strong>{money(total)}</strong></div><button type="button" className="btn btn-primary full" disabled={!lines.length} onClick={beginCheckout}>Continuar pedido <ArrowRight size={18}/></button><p>Probá el recorrido del pedido, sin envío ni pago real.</p></div></>
      : <><form className="checkout-form" id="taberna-checkout" onSubmit={checkout}><div className="checkout-back"><button type="button" onClick={()=>setSheet("cart")}><ArrowLeft size={16}/> Volver al carrito</button></div>
          <div className="form-section"><h3><span>01</span> Tus datos</h3><label>Nombre y apellido *<input required value={customer.name} onChange={e=>setCustomer(c=>({...c,name:e.target.value}))} placeholder="Tu nombre"/></label><label>Teléfono *<input required inputMode="tel" value={customer.phone} onChange={e=>setCustomer(c=>({...c,phone:e.target.value}))} placeholder="Ej. 358 555 1234"/></label></div>
          <div className="form-section"><h3><span>02</span> Entrega</h3>{deliveryChoice(true)}{delivery==="Envío" && <label className="address-field">Dirección de entrega *<input required value={customer.address} onChange={e=>setCustomer(c=>({...c,address:e.target.value}))} placeholder="Localidad, calle y número"/></label>}</div>
          <div className="form-section"><h3><span>03</span> Forma de pago</h3><div className="payment-choices">{["Efectivo","Transferencia","Mercado Pago"].map(method=><button type="button" key={method} className={customer.payment===method?"chosen":""} onClick={()=>setCustomer(c=>({...c,payment:method}))}><Wallet size={17}/>{method}{customer.payment===method&&<Check size={15}/>}</button>)}</div><small>Elegí una opción para ver cómo quedaría el pedido. No se realiza ningún cobro.</small></div>
          <div className="form-section"><label>Aclaraciones (opcional)<textarea rows={3} placeholder="Indicaciones o consultas sobre tu pedido..." value={customer.notes} onChange={e=>setCustomer(c=>({...c,notes:e.target.value}))}/></label></div>
          <div className="summary-box"><h3>Resumen del pedido</h3>{lines.map(({product,count})=><div key={product.id}><span>{count} × {product.name}</span><strong>{money(product.price*count)}</strong></div>)}<div className="summary-total"><strong>Total</strong><strong>{money(total)}</strong></div></div>
          <label className="age-check"><input type="checkbox" required checked={customer.age} onChange={e=>setCustomer(c=>({...c,age:e.target.checked}))}/><span>Confirmo que soy mayor de 18 años.</span></label>
        </form><div className="sheet-footer"><div className="footer-total"><span>Total del pedido</span><strong>{money(total)}</strong></div><button className="btn btn-primary full" type="submit" form="taberna-checkout" disabled={!lines.length}>Simular pedido <ArrowRight size={18}/></button><p>Vista previa: no se enviará el pedido ni se realizará ningún pago.</p></div></>}
    </aside></div>}
  </div>;
}
