"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownToLine, ArrowLeft, ArrowRight, BarChart3, CalendarDays, Check, CheckCircle2, ChevronDown, CircleAlert, Clock3, DollarSign, FileDown, ImagePlus, LayoutDashboard, Menu, Minus, Package, Pencil, Plus, RotateCcw, Search, ShoppingBag, SlidersHorizontal, Trash2, TrendingUp, Wallet, Wine, X } from "lucide-react";
import { CATEGORIES, INITIAL_PRODUCTS, money, type Category, type Order, type Product } from "@/data/catalog";
import { SYNC_EVENT, readCatalog, readOrders, writeCatalog, writeOrders, idForOrder } from "@/lib/storage";

type Tab = "dashboard" | "productos" | "pedidos";
type ProductDraft = { name:string; category:Category; volume:string; price:string; stock:string; description:string; image:string; badge:string; active:boolean };
const blankDraft: ProductDraft = { name:"", category:"Cervezas", volume:"750 ml", price:"", stock:"0", description:"", image:"", badge:"", active:true };
const nfmt = (n:number)=>new Intl.NumberFormat("es-AR").format(n);
const stamp = (iso:string) => new Date(iso).toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"});
const monthName = (date:Date) => date.toLocaleString("es-AR", {month:"short"}).replace(".","").toUpperCase();
const isOrder = (o:Order) => o && (o.status === "pendiente" || o.status === "completado") && Array.isArray(o.items);

function downloadText(name:string,content:string,mime:string) { const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500); }
function csvSafe(value:string|number) {return `"${String(value).replaceAll('"','""')}"`;}

async function optimizeImage(file:File):Promise<string> {
  if (!file.type.startsWith("image/")) throw Error("Elegí una imagen válida.");
  if (file.size > 10*1024*1024) throw Error("La foto supera los 10 MB.");
  const url=URL.createObjectURL(file);
  try {
    const img=new window.Image();img.src=url;await img.decode();
    const ratio=Math.min(1,900/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement("canvas");canvas.width=Math.round(img.naturalWidth*ratio);canvas.height=Math.round(img.naturalHeight*ratio);
    const ctx=canvas.getContext("2d");if(!ctx) throw Error("No se pudo procesar la foto.");
    ctx.fillStyle="#f4f4f3";ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL("image/jpeg",0.78);
  } finally { URL.revokeObjectURL(url); }
}

export default function AdminDashboard() {
  const [products,setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [orders,setOrders] = useState<Order[]>([]);
  const [mounted,setMounted] = useState(false);
  const [tab,setTab] = useState<Tab>("dashboard");
  const [filter,setFilter] = useState("Todas");
  const [query,setQuery] = useState("");
  const [status,setStatus] = useState("todos");
  const [months,setMonths] = useState<6|12>(6);
  const [editor,setEditor] = useState<number|null>(null);
  const [open,setOpen] = useState(false);
  const [draft,setDraft] = useState<ProductDraft>(blankDraft);
  const [notice,setNotice] = useState("");
  const [saleOpen,setSaleOpen] = useState(false);
  const [saleProduct,setSaleProduct] = useState("");
  const [saleQty,setSaleQty] = useState("1");
  const [saleDate,setSaleDate] = useState(()=>new Date().toISOString().slice(0,10));
  const [mobileNav,setMobileNav] = useState(false);

  useEffect(()=>{
    setProducts(readCatalog());setOrders(readOrders().filter(isOrder));setMounted(true);
    const sync=()=>{setProducts(readCatalog());setOrders(readOrders().filter(isOrder));};
    window.addEventListener(SYNC_EVENT,sync);window.addEventListener("storage",sync);
    return ()=>{window.removeEventListener(SYNC_EVENT,sync);window.removeEventListener("storage",sync);};
  },[]);
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(""),3200);return ()=>clearTimeout(t);},[notice]);
  useEffect(()=>{
    if(!open&&!saleOpen)return;
    const old=document.body.style.overflow;document.body.style.overflow="hidden";
    const fn=(e:KeyboardEvent)=>{if(e.key==="Escape"){setOpen(false);setSaleOpen(false);}};
    document.addEventListener("keydown",fn);
    return ()=>{document.body.style.overflow=old;document.removeEventListener("keydown",fn);};
  },[open,saleOpen]);

  const completed=orders.filter(o=>o.status==="completado");
  const totalSales=completed.reduce((n,o)=>n+o.total,0);
  const today=new Date();const period=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
  const monthly=completed.filter(o=>o.createdAt.slice(0,7)===period);
  const monthAmount=monthly.reduce((n,o)=>n+o.total,0);
  const inventory=products.reduce((n,p)=>n+p.stock*p.price,0);
  const active=products.filter(p=>p.active).length;
  const lowStock=products.filter(p=>p.active&&p.stock<=5).length;
  const pending=orders.filter(o=>o.status==="pendiente").length;
  const avg=completed.length?totalSales/completed.length:0;
  const chart=useMemo(()=>Array.from({length:months},(_,i)=>{
    const d=new Date(today.getFullYear(),today.getMonth()-(months-1-i),1);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const o=completed.filter(a=>a.createdAt.slice(0,7)===key);return {key,label:monthName(d),amount:o.reduce((s,r)=>s+r.total,0),count:o.length};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }),[orders,months]);
  const chartMax=Math.max(1,...chart.map(x=>x.amount));
  const points=chart.map((x,i)=>({x:38+i*620/Math.max(1,chart.length-1),y:208-(x.amount/chartMax)*160,...x}));
  const path=points.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
  const area=`${path} L${points.at(-1)?.x||38},208 L38,208 Z`;
  const topProducts=useMemo(()=>{
    const tally=new Map<number,{name:string;qty:number;amount:number}>();
    for(const o of completed) for(const item of o.items){const prev=tally.get(item.id);tally.set(item.id,{name:item.name,qty:(prev?.qty||0)+item.quantity,amount:(prev?.amount||0)+item.price*item.quantity});}
    return [...tally.values()].sort((a,b)=>b.qty-a.qty).slice(0,4);
  },[orders]);
  const display=products.filter(p=>(filter==="Todas"||p.category===filter)&&(status==="todos"||(status==="publicados"&&p.active)||(status==="ocultos"&&!p.active)||(status==="bajo"&&p.stock<=5))&&`${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name,"es"));

  function saveProducts(next:Product[]) {try {writeCatalog(next);setProducts(next);setNotice("Productos actualizados.");}catch {setNotice("No hay espacio en el navegador para guardar los cambios.");}}
  function saveOrders(next:Order[]) {try {writeOrders(next);setOrders(next);setNotice("Pedidos actualizados.");}catch {setNotice("No se pudieron guardar los pedidos.");}}
  function editProduct(p?:Product) {
    setEditor(p?.id??null);
    setDraft(p?{name:p.name,category:p.category,volume:p.volume,price:String(p.price),stock:String(p.stock),description:p.description,image:p.image,badge:p.badge||"",active:p.active}: {...blankDraft});
    setOpen(true);
  }
  async function uploadPhoto(e:ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0];if(!file)return;
    try{const data=await optimizeImage(file);setDraft(d=>({...d,image:data}));setNotice("Imagen lista para guardar.");}catch(err){setNotice(err instanceof Error?err.message:"No se pudo procesar la imagen.");}
    e.target.value="";
  }
  function submitProduct(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();const price=Number(draft.price),stock=Number(draft.stock);
    if(!draft.name.trim()||!Number.isFinite(price)||price<0||!Number.isInteger(stock)||stock<0||!draft.image){setNotice("Completá nombre, imagen, precio y stock correctamente.");return;}
    const id=editor ?? Math.max(0,...products.map(p=>p.id))+1;
    const product:Product={id,name:draft.name.trim(),category:draft.category,volume:draft.volume.trim(),price,stock,image:draft.image,description:draft.description.trim(),badge:draft.badge.trim()||undefined,active:draft.active};
    saveProducts(editor===null?[product,...products]:products.map(p=>p.id===editor?product:p));setOpen(false);
  }
  function deleteProduct(p:Product){if(!window.confirm(`¿Eliminar ${p.name} del catálogo?`))return;saveProducts(products.filter(x=>x.id!==p.id));}
  function restore() {if(!window.confirm("¿Restaurar el catálogo inicial? Se perderán las modificaciones locales de productos."))return;saveProducts(INITIAL_PRODUCTS);}
  function setOrderStatus(o:Order) {
    const completedNow=o.status==="pendiente";
    const next=orders.map(x=>x.id===o.id?{...x,status:completedNow?"completado":"pendiente"} as Order:x);
    saveOrders(next);
    if(completedNow) {
      const nextProducts=products.map(p=>({...p,stock:Math.max(0,p.stock-o.items.filter(it=>it.id===p.id).reduce((n,it)=>n+it.quantity,0))}));
      saveProducts(nextProducts);
    } else {
      const nextProducts=products.map(p=>({...p,stock:p.stock+o.items.filter(it=>it.id===p.id).reduce((n,it)=>n+it.quantity,0)}));
      saveProducts(nextProducts);
    }
  }
  function createSale(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();const p=products.find(x=>String(x.id)===saleProduct);const qty=Number(saleQty);
    if(!p||!Number.isInteger(qty)||qty<1||qty>p.stock||!saleDate){setNotice("Elegí un producto y una cantidad válida según el stock.");return;}
    const o:Order={id:idForOrder(),customer:"Venta presencial",phone:"",delivery:"Retiro",address:"",payment:"No especificado",notes:"Venta cargada desde administración",createdAt:`${saleDate}T12:00:00.000Z`,items:[{id:p.id,name:p.name,quantity:qty,price:p.price}],total:qty*p.price,status:"completado",origin:"manual"};
    saveOrders([o,...orders]);saveProducts(products.map(it=>it.id===p.id?{...it,stock:it.stock-qty}:it));setSaleOpen(false);setSaleProduct("");setSaleQty("1");
  }
  function exportCatalog(){downloadText("la-taberna-productos.json",JSON.stringify(products,null,2),"application/json;charset=utf-8");}
  function exportSales(){const rows=[["Pedido","Fecha","Cliente","Origen","Estado","Total","Productos"],...orders.map(o=>[o.id,stamp(o.createdAt),o.customer,o.origin,o.status,o.total,o.items.map(i=>`${i.quantity} x ${i.name}`).join(" | ")])];downloadText("la-taberna-pedidos.csv","\ufeff"+rows.map(r=>r.map(csvSafe).join(";")).join("\r\n"),"text/csv;charset=utf-8");}

  return <div className="admin-shell">
    <aside className={`admin-sidebar ${mobileNav?"shown":""}`}>
      <div className="sidebar-logo"><div className="sidebar-monogram">lt.</div><div><strong>la taberna.</strong><span>ADMINISTRACIÓN</span></div></div>
      <div className="sidebar-kicker">MENÚ PRINCIPAL</div>
      <nav className="admin-nav">
        <button type="button" className={tab==="dashboard"?"active":""} onClick={()=>{setTab("dashboard");setMobileNav(false);}}><LayoutDashboard size={19}/> Resumen general</button>
        <button type="button" className={tab==="productos"?"active":""} onClick={()=>{setTab("productos");setMobileNav(false);}}><Package size={19}/> Productos <span>{products.length}</span></button>
        <button type="button" className={tab==="pedidos"?"active":""} onClick={()=>{setTab("pedidos");setMobileNav(false);}}><ShoppingBag size={19}/> Pedidos {pending>0 && <span>{pending}</span>}</button>
      </nav>
      <div className="sidebar-bottom"><Link href="/"><ArrowLeft size={18}/> Ver tienda</Link><div><span className="live-dot"/> Catálogo activo</div></div>
    </aside>
    <div className="admin-content">
      <header className="admin-topbar"><div className="admin-topbar-left"><button className="admin-mobile-menu" type="button" aria-label="Abrir menú" onClick={()=>setMobileNav(!mobileNav)}><Menu size={22}/></button><span>LA TABERNA / ADMINISTRACIÓN</span></div><div className="admin-topbar-right"><span><CalendarDays size={16}/> {new Date().toLocaleDateString("es-AR",{day:"numeric",month:"long",year:"numeric"})}</span><Link href="/">Ver tienda <ArrowRight size={15}/></Link></div></header>
      <main className="admin-main">
        <div className="admin-heading"><div><p className="eyebrow"><span className="status-dot"/> PANEL DE CONTROL</p><h1>{tab==="dashboard"?"Resumen general.":tab==="productos"?"Mis productos.":"Gestión de pedidos."}</h1><p>{tab==="dashboard"?"Mirá el estado de tu catálogo y el rendimiento del negocio.":tab==="productos"?"Actualizá imágenes, precios, disponibilidad y stock.":"Revisá las solicitudes y registrá las ventas confirmadas."}</p></div><div className="admin-heading-actions">{tab!=="pedidos"&&<button type="button" className="btn btn-primary" onClick={()=>editProduct()}><Plus size={18}/> Nuevo producto</button>}{tab==="pedidos"&&<button type="button" className="btn btn-primary" onClick={()=>setSaleOpen(true)}><Plus size={18}/> Registrar venta</button>}</div></div>

        {tab==="dashboard" && <>
          <div className="metric-grid">
            <div className="metric"><span className="metric-icon"><Package size={21}/></span><span>Productos publicados</span><strong>{active}</strong><small>{products.length} productos en total</small></div>
            <div className="metric"><span className="metric-icon"><ShoppingBag size={21}/></span><span>Pedidos pendientes</span><strong>{pending}</strong><small>Esperando confirmación</small></div>
            <div className="metric"><span className="metric-icon warn"><CircleAlert size={21}/></span><span>Stock bajo (0 a 5)</span><strong>{lowStock}</strong><small>Productos para reponer</small></div>
            <div className="metric"><span className="metric-icon"><TrendingUp size={21}/></span><span>Valor del inventario</span><strong className="metric-currency">{money(inventory)}</strong><small>Calculado a precio de venta</small></div>
          </div>
          <div className="section-title-row"><div><p className="eyebrow"><BarChart3 size={16}/> ESTADÍSTICAS</p><h2>Ventas y rendimiento.</h2><p>Se contabilizan como ventas las operaciones marcadas como completadas.</p></div><div className="dash-buttons"><button type="button" className="btn btn-secondary" onClick={exportSales}><ArrowDownToLine size={17}/> Exportar CSV</button><button type="button" className="btn btn-primary" onClick={()=>setSaleOpen(true)}><Plus size={17}/> Registrar venta</button></div></div>
          <div className="sales-metrics"><div><span>Facturación del mes</span><strong>{money(monthAmount)}</strong><small>{monthly.length} ventas completadas</small></div><div><span>Ventas registradas</span><strong>{completed.length}</strong><small>Histórico total</small></div><div><span>Ticket promedio</span><strong>{money(avg)}</strong><small>Por venta completada</small></div></div>
          <div className="insights-grid"><section className="chart-panel"><div className="panel-top"><div><h3>Evolución de ventas</h3><p>Facturación mensual en pesos argentinos</p></div><div className="chart-tabs"><button type="button" className={months===6?"active":""} onClick={()=>setMonths(6)}>6 meses</button><button type="button" className={months===12?"active":""} onClick={()=>setMonths(12)}>12 meses</button></div></div><div className="chart-value"><strong>{money(monthAmount)}</strong><small>Este mes</small></div><div className="chart-wrapper"><svg viewBox="0 0 700 240" preserveAspectRatio="none" role="img" aria-label="Gráfico de facturación de los últimos meses"><defs><linearGradient id="chartFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1c4c8d" stopOpacity="0.22"/><stop offset="1" stopColor="#1c4c8d" stopOpacity="0"/></linearGradient></defs>{[48,101,154,208].map(y=><line key={y} x1="37" x2="663" y1={y} y2={y} stroke="#e4e8ec" strokeDasharray="5 6"/>)}<path d={area} fill="url(#chartFade)"/><path d={path} stroke="#245896" strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round"/>{points.map(p=><circle key={p.key} cx={p.x} cy={p.y} r="5" fill="#fff" stroke="#245896" strokeWidth="3"><title>{`${p.label}: ${money(p.amount)}`}</title></circle>)}</svg></div><div className="chart-months">{chart.map(x=><span key={x.key}>{x.label}</span>)}</div>{totalSales===0&&<p className="empty-chart-msg">Todavía no hay ventas completadas. Registrá una venta o completá un pedido para visualizar los movimientos.</p>}</section>
          <section className="tops-panel"><h3>Más vendidos</h3><p>Productos por unidades vendidas</p>{topProducts.length?topProducts.map((x,i)=><div className="top-product" key={x.name}><span>{String(i+1).padStart(2,"0")}</span><div><strong>{x.name}</strong><small>{x.qty} unidades</small><div className="top-progress"><i style={{width:`${(x.qty/topProducts[0].qty)*100}%`}}/></div></div></div>):<div className="tops-empty"><Wine size={33}/><p>Los productos más vendidos aparecerán cuando registres ventas.</p></div>}<button className="subtle-link" type="button" onClick={()=>setTab("pedidos")}>Ver pedidos <ArrowRight size={16}/></button></section></div>
          <div className="recent-section"><div className="panel-top"><h3>Últimos pedidos</h3><button type="button" className="subtle-link" onClick={()=>setTab("pedidos")}>Ver todos <ArrowRight size={16}/></button></div>{orders.slice(0,4).length?<div className="recent-list">{orders.slice(0,4).map(o=><div key={o.id}><div><strong>{o.customer}</strong><small>{o.id} · {stamp(o.createdAt)}</small></div><span className={`order-status ${o.status}`}>{o.status}</span><b>{money(o.total)}</b></div>)}</div>:<p className="admin-empty-note">Todavía no se registraron pedidos.</p>}</div>
        </>}

        {tab==="productos" && <div className="admin-panel"><div className="products-panel-head"><div><h2>Catálogo de productos</h2><p>{display.length} resultados</p></div><div className="product-action-row"><button className="btn btn-secondary" type="button" onClick={exportCatalog}><FileDown size={17}/> Exportar JSON</button><button className="btn btn-secondary" type="button" onClick={restore}><RotateCcw size={17}/> Restaurar</button></div></div>
          <div className="admin-filters"><label className="search-input"><Search size={19}/><input placeholder="Buscar por nombre o categoría..." aria-label="Buscar productos" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="select-filter"><select aria-label="Filtrar categoría" value={filter} onChange={e=>setFilter(e.target.value)}>{CATEGORIES.map(c=><option value={c} key={c}>{c}</option>)}</select><ChevronDown size={15}/></label><label className="select-filter"><select aria-label="Filtrar estado" value={status} onChange={e=>setStatus(e.target.value)}><option value="todos">Todos los estados</option><option value="publicados">Publicados</option><option value="ocultos">Ocultos</option><option value="bajo">Stock bajo</option></select><ChevronDown size={15}/></label></div>
          <div className="admin-product-list">{display.length?display.map(p=><div className="admin-product" key={p.id}><div className="admin-product-img"><Image src={p.image||"/images/placeholder.svg"} alt={p.name} width={90} height={90} unoptimized={p.image.startsWith("data:")}/></div><div className="admin-product-title"><strong>{p.name}</strong><small>{p.category} · {p.volume}</small><span className={`product-status ${p.active?"published":"hidden"}`}>{p.active?"Publicado":"Oculto"}</span></div><div className="admin-product-price"><small>PRECIO</small><strong>{money(p.price)}</strong></div><div className="admin-product-stock"><small>STOCK</small><div className="qty"><button type="button" aria-label={`Restar stock de ${p.name}`} disabled={p.stock===0} onClick={()=>saveProducts(products.map(x=>x.id===p.id?{...x,stock:x.stock-1}:x))}><Minus size={16}/></button><span>{p.stock}</span><button type="button" aria-label={`Sumar stock de ${p.name}`} onClick={()=>saveProducts(products.map(x=>x.id===p.id?{...x,stock:x.stock+1}:x))}><Plus size={16}/></button></div></div><div className="admin-product-actions"><button type="button" onClick={()=>editProduct(p)}><Pencil size={16}/> Editar</button><button type="button" title={p.active?"Ocultar producto":"Publicar producto"} onClick={()=>saveProducts(products.map(x=>x.id===p.id?{...x,active:!x.active}:x))}><Check size={17}/></button><button type="button" title="Eliminar producto" onClick={()=>deleteProduct(p)}><Trash2 size={17}/></button></div></div>):<p className="admin-empty-note">No hay productos con estos filtros.</p>}</div>
        </div>}

        {tab==="pedidos" && <div className="admin-panel"><div className="products-panel-head"><div><h2>Pedidos recibidos</h2><p>{orders.length} registros · {pending} pendientes</p></div><div className="product-action-row"><button className="btn btn-secondary" type="button" onClick={exportSales}><ArrowDownToLine size={17}/> Descargar CSV</button><button className="btn btn-primary" type="button" onClick={()=>setSaleOpen(true)}><Plus size={17}/> Registrar venta</button></div></div>
          {orders.length ? <div className="orders-list">{orders.map(o=><article className="order-item" key={o.id}><div className="order-item-top"><div><span className="order-code">{o.id}</span><strong>{o.customer}</strong><small>{stamp(o.createdAt)} · {o.origin==="manual"?"Registro manual":o.delivery}</small></div><span className={`order-status ${o.status}`}>{o.status}</span></div><p>{o.items.map(i=>`${i.quantity} × ${i.name}`).join(" · ")}</p><div className="order-item-bottom"><strong>{money(o.total)}</strong><button type="button" onClick={()=>setOrderStatus(o)}>{o.status==="pendiente"?<><CheckCircle2 size={16}/> Marcar completado</>:<><RotateCcw size={16}/> Volver a pendiente</>}</button></div></article>)}</div>:<div className="orders-empty"><ShoppingBag size={35}/><h3>Sin pedidos por ahora</h3><p>Los pedidos preparados desde la tienda en este navegador aparecen aquí. También podés registrar una venta presencial.</p><button type="button" className="btn btn-primary" onClick={()=>setSaleOpen(true)}><Plus size={17}/> Registrar venta</button></div>}
        </div>}
      </main>
    </div>
    {notice&&<div className="toast" role="status">{notice}</div>}
    {open && <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}><div className="admin-editor" role="dialog" aria-modal="true" aria-label={editor===null?"Nuevo producto":"Editar producto"}><div className="editor-header"><div><p className="eyebrow">CATÁLOGO LA TABERNA</p><h2>{editor===null?"Nuevo producto.":"Editar producto."}</h2></div><button className="close-btn" onClick={()=>setOpen(false)} aria-label="Cerrar" type="button"><X size={21}/></button></div><form id="product-form" onSubmit={submitProduct} className="editor-form"><div className="upload-photo"><div className="editor-preview">{draft.image?<Image src={draft.image} alt="Vista previa del producto" width={110} height={110} unoptimized={draft.image.startsWith("data:")}/>:<ImagePlus size={31}/>}</div><div><strong>Imagen del producto</strong><p>Subí una foto o ingresá la ruta de la imagen.</p><label className="btn btn-secondary upload-button"><ImagePlus size={17}/> Subir foto <input type="file" accept="image/*" onChange={uploadPhoto}/></label></div></div>
        <label>URL o ruta de la imagen<input placeholder="/images/mi-producto.webp" value={draft.image.startsWith("data:")?"Imagen cargada desde el equipo":draft.image} onChange={e=>setDraft(d=>({...d,image:e.target.value}))} readOnly={draft.image.startsWith("data:")}/></label>
        <label>Nombre del producto *<input required value={draft.name} placeholder="Ej. Fernet Branca" onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/></label><div className="form-cols"><label>Categoría *<select value={draft.category} onChange={e=>setDraft(d=>({...d,category:e.target.value as Category}))}>{CATEGORIES.filter(c=>c!=="Todas").map(c=><option key={c}>{c}</option>)}</select></label><label>Presentación<input value={draft.volume} placeholder="750 ml" onChange={e=>setDraft(d=>({...d,volume:e.target.value}))}/></label></div>
        <div className="form-cols"><label>Precio (ARS) *<input type="number" required min="0" step="1" value={draft.price} onChange={e=>setDraft(d=>({...d,price:e.target.value}))}/></label><label>Stock disponible *<input type="number" min="0" step="1" required value={draft.stock} onChange={e=>setDraft(d=>({...d,stock:e.target.value}))}/></label></div>
        <label>Etiqueta especial<input placeholder="DESTACADO" value={draft.badge} onChange={e=>setDraft(d=>({...d,badge:e.target.value}))}/></label><label>Descripción<textarea rows={3} value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))}/></label><label className="editor-check"><input type="checkbox" checked={draft.active} onChange={e=>setDraft(d=>({...d,active:e.target.checked}))}/> Producto publicado en la tienda</label>
        </form><div className="editor-footer"><button className="btn btn-secondary" type="button" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn btn-primary" type="submit" form="product-form"><Check size={17}/>{editor===null?"Crear producto":"Guardar cambios"}</button></div></div></div>}
    {saleOpen&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSaleOpen(false);}}><div className="admin-editor sale-editor" role="dialog" aria-modal="true" aria-label="Registrar venta"><div className="editor-header"><div><p className="eyebrow">VENTAS · LA TABERNA</p><h2>Registrar venta.</h2></div><button type="button" className="close-btn" onClick={()=>setSaleOpen(false)} aria-label="Cerrar"><X size={21}/></button></div><form id="sale-form" onSubmit={createSale} className="editor-form"><p className="sale-note">Las ventas registradas se reflejan en las estadísticas y descuentan unidades del stock.</p><label>Producto *<select required value={saleProduct} onChange={e=>setSaleProduct(e.target.value)}><option value="">Seleccionar bebida</option>{products.filter(p=>p.stock>0).map(p=><option key={p.id} value={p.id}>{p.name} — {money(p.price)} (stock {p.stock})</option>)}</select></label><div className="form-cols"><label>Cantidad *<input required min={1} type="number" value={saleQty} onChange={e=>setSaleQty(e.target.value)}/></label><label>Fecha *<input required type="date" value={saleDate} onChange={e=>setSaleDate(e.target.value)}/></label></div><div className="sale-estimate"><span>Total de la venta</span><strong>{money((products.find(p=>String(p.id)===saleProduct)?.price||0)*Math.max(0,Number(saleQty)||0))}</strong></div></form><div className="editor-footer"><button type="button" className="btn btn-secondary" onClick={()=>setSaleOpen(false)}>Cancelar</button><button type="submit" form="sale-form" className="btn btn-primary"><Check size={17}/> Guardar venta</button></div></div></div>}
  </div>;
}
