import React, { useState, useEffect } from "react";
import { db, auth } from "./firebase"; 
import { collection, onSnapshot, addDoc, updateDoc, doc, getDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

// CONFIGURACIÓN DE CLOUDINARY
const CLOUD_NAME = "dp4m3p0do"; 
const UPLOAD_PRESET = "unsigned_preset"; 

export default function App() {
  const [view, setView] = useState("welcome");
  const [user, setUser] = useState(null);
  const [houses, setHouses] = useState([]);
  const [filteredHouses, setFilteredHouses] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [selectedHouse, setSelectedHouse] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [uploading, setUploading] = useState(false);
  const [tempImages, setTempImages] = useState([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userSnap = await getDoc(doc(db, "users", currentUser.email.toLowerCase().trim()));
        setUser({ email: currentUser.email, role: (userSnap.exists() && userSnap.data().role === "admin") ? "admin" : "asesor" });
        setView("app");
      } else { setUser(null); }
    });
    const unsubHouses = onSnapshot(collection(db, "houses"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setHouses(list);
      setFilteredHouses(list);
    });
    return () => { unsubAuth(); unsubHouses(); };
  }, []);

  // LÓGICA DE BÚSQUEDA CORREGIDA (AHORA BUSCA PRECIOS TAMBIÉN)
  useEffect(() => {
    const term = search.toLowerCase();
    const results = houses.filter(h => {
      const modelo = h.modelo?.toLowerCase() || "";
      const ubicacion = h.ubicacion?.toLowerCase() || "";
      const precio = h.precio?.toString().toLowerCase() || ""; // Convertimos precio a texto para buscar
      
      return modelo.includes(term) || ubicacion.includes(term) || precio.includes(term);
    });
    setFilteredHouses(results);
  }, [search, houses]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
      const data = await res.json();
      setTempImages([...tempImages, data.secure_url]);
    } catch (err) { alert("Error al subir foto"); }
    setUploading(false);
  };

  const saveHouse = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.imagenes = editing ? [...(editing.imagenes || []), ...tempImages] : tempImages;
    try {
      if (editing) await updateDoc(doc(db, "houses", editing.id), data);
      else await addDoc(collection(db, "houses"), data);
      setTempImages([]); setShowModal(false); setEditing(null);
    } catch (err) { alert("Error al guardar"); }
  };

  const sendWhatsApp = (h) => {
    const fotosLink = h.imagenes?.map((img, i) => `%0A📸 Foto ${i+1}: ${img}`).join('') || '';
    const msg = `*DK TU CASA INMOBILIARIA*%0A📍 ${h.ubicacion.toUpperCase()}%0A🏠 *Modelo:* ${h.modelo.toUpperCase()}%0A💰 *Precio:* ${h.precio}%0A🏢 *Niveles:* ${h.niveles || '1'}%0A🛌 *Hab:* ${h.recamaras} | 🚿 *Baños:* ${h.banos}%0A📐 *T:* ${h.terreno} m2 | 🏠 *C:* ${h.construccion} m2${fotosLink}`;
    window.open(`https://wa.me/5281XXXXXXXX?text=${msg}`, "_blank");
  };

  if (view === "welcome") return (
    <div style={s.loginContainer}><div style={s.loginCard}>
        <h1 style={{color: '#00BFFF', fontWeight: '800', fontSize: '32px'}}>DK TU CASA</h1>
        <button onClick={() => setView("app")} style={s.btnPrimary}>Ver Catálogo (Cliente)</button>
        <button onClick={() => setView("login")} style={s.btnSecondary}>Acceso Administrativo</button>
    </div></div>
  );

  if (view === "login" && !user) return (
    <div style={s.loginContainer}><div style={s.loginCard}>
        <h2 style={{color: '#1A237E', marginBottom: '20px'}}>Iniciar Sesión</h2>
        <form onSubmit={(e) => { e.preventDefault(); signInWithEmailAndPassword(auth, email, password); }}>
          <input type="email" placeholder="Correo" style={s.input} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Contraseña" style={s.input} onChange={e => setPassword(e.target.value)} />
          <button style={s.btnPrimary}>Entrar</button>
          <button type="button" onClick={() => setView("welcome")} style={{background: 'none', border: 'none', marginTop: '15px'}}>Volver</button>
        </form>
    </div></div>
  );

  return (
    <div style={s.container}>
      <header style={s.header}>
        <div style={{flex: 1}}>
            <h1 style={s.headerTitle} onClick={() => setView("welcome")}>DK TU CASA</h1>
            <p style={s.headerSubtitle}>{user ? `Hola, ${user.email}` : "Catálogo para Clientes"}</p>
        </div>
        <div style={{display: 'flex', gap: '8px'}}>
          {user?.role === 'admin' && <button onClick={() => setShowModal(true)} style={s.btnAdmin}>+ Nueva Propiedad</button>}
          {user ? <button onClick={() => signOut(auth).then(() => setView("welcome"))} style={s.btnOut}>Salir</button> : <button onClick={() => setView("welcome")} style={s.btnOut}>Menú</button>}
        </div>
      </header>

      <input placeholder="Buscar por modelo, zona, precio..." style={s.search} value={search} onChange={e => setSearch(e.target.value)} />

      <div style={s.grid}>
        {filteredHouses.map(h => (
          <div key={h.id} style={s.card} onClick={() => setSelectedHouse(h)}>
            <div style={s.carouselWrapper}>
                <div style={s.carouselContainer}>
                    {h.imagenes?.map((img, idx) => <img key={idx} src={img} style={s.img} />)}
                </div>
            </div>
            <div style={s.cardBody}>
              <div style={s.cardHeaderLine}><h2 style={s.cardTitle}>{h.modelo}</h2><span style={s.cardPrice}>${h.precio}</span></div>
              <p style={s.cardLoc}>📍 {h.ubicacion}</p>
              <div style={s.divider}></div>
              <div style={s.detailsRow}>
                <div style={s.detCol}><strong>{h.recamaras}</strong><small>Hab.</small></div>
                <div style={s.detCol}><strong>{h.banos}</strong><small>Baños</small></div>
                <div style={s.detCol}><strong>{h.terreno}m2</strong><small>T. m²</small></div>
                <div style={s.detCol}><strong>{h.construccion}m2</strong><small>C. m²</small></div>
              </div>
              {h.promocion && <div style={s.promoBox}>🎁 Promoción: {h.promocion}</div>}
              <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
                <button onClick={(e) => { e.stopPropagation(); sendWhatsApp(h); }} style={s.btnWa}>WhatsApp</button>
                {user?.role === 'admin' && <button onClick={(e) => { e.stopPropagation(); setEditing(h); setShowModal(true); }} style={s.btnEd}>Editar Información</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedHouse && (
        <div style={s.overlay} onClick={() => setSelectedHouse(null)}>
          <div style={s.detailModal} onClick={e => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setSelectedHouse(null)}>✕</button>
            <div style={s.carouselWrapperDetail}>
                <div style={s.carouselContainer}>
                    {selectedHouse.imagenes?.map((img, idx) => <img key={idx} src={img} style={s.img} />)}
                </div>
            </div>
            <h2 style={s.cardTitle}>{selectedHouse.modelo}</h2>
            <h3 style={s.cardPrice}>${selectedHouse.precio}</h3>
            <p style={s.cardLoc}>📍 {selectedHouse.ubicacion}</p>
            <div style={s.divider}></div>
            <div style={s.techGrid}>
                <div style={s.techItem}><span>Pisos / Niveles:</span> <strong>{selectedHouse.niveles || "1"}</strong></div>
                <div style={s.techItem}><span>Habitaciones:</span> <strong>{selectedHouse.recamaras || "0"}</strong></div>
                <div style={s.techItem}><span>Baños:</span> <strong>{selectedHouse.banos || "0"}</strong></div>
                <div style={s.techItem}><span>Terreno Total:</span> <strong>{selectedHouse.terreno || "0"} m²</strong></div>
                <div style={s.techItem}><span>Construcción:</span> <strong>{selectedHouse.construccion || "0"} m²</strong></div>
            </div>
            <div style={s.divider}></div>
            <p><strong>Descripción:</strong><br/>{selectedHouse.descripcion || "Sin descripción adicional."}</p>
            <p style={{marginTop: '10px'}}><strong>Amenidades:</strong><br/>{selectedHouse.amenidades || "N/A"}</p>
            
            <button onClick={() => sendWhatsApp(selectedHouse)} style={{...s.btnWa, width: '100%', marginTop: '20px'}}>WhatsApp</button>
          </div>
        </div>
      )}

      {showModal && (
        <div style={s.overlay}>
          <form onSubmit={saveHouse} style={s.modal}>
            <h3 style={{marginBottom: '15px'}}>{editing ? "Editar Propiedad" : "Nueva Propiedad"}</h3>
            <div style={s.uploadZone}>
                <input type="file" accept="image/*" onChange={handleUpload} />
                <p style={{fontSize: '11px'}}>Fotos: {tempImages.length + (editing?.imagenes?.length || 0)}</p>
            </div>
            <div style={s.formGrid}>
              <input name="modelo" placeholder="Modelo" defaultValue={editing?.modelo} required style={s.input} />
              <input name="ubicacion" placeholder="Ubicación" defaultValue={editing?.ubicacion} required style={s.input} />
              <input name="precio" placeholder="Precio" defaultValue={editing?.precio} required style={s.input} />
              <input name="promocion" placeholder="Promoción" defaultValue={editing?.promocion} style={s.input} />
              <input name="recamaras" placeholder="Habitaciones" defaultValue={editing?.recamaras} style={s.input} />
              <input name="banos" placeholder="Baños" defaultValue={editing?.banos} style={s.input} />
              <input name="niveles" placeholder="Pisos" defaultValue={editing?.niveles} style={s.input} />
              <input name="terreno" placeholder="Terreno m2" defaultValue={editing?.terreno} style={s.input} />
              <input name="construccion" placeholder="Construcción m2" defaultValue={editing?.construccion} style={s.input} />
              <textarea name="amenidades" placeholder="Amenidades..." defaultValue={editing?.amenidades} style={{...s.input, gridColumn: 'span 2', height: '40px'}} />
              <textarea name="descripcion" placeholder="Descripción..." defaultValue={editing?.descripcion} style={{...s.input, gridColumn: 'span 2', height: '60px'}} />
            </div>
            <button type="submit" style={s.btnPrimary}>Guardar Cambios</button>
            <button type="button" onClick={() => {setShowModal(false); setTempImages([]); setEditing(null)}} style={s.btnCancel}>Cancelar</button>
          </form>
        </div>
      )}
    </div>
  );
}

const s = {
  container: { padding: '20px 15px', maxWidth: '1200px', margin: '0 auto', fontFamily: '-apple-system, sans-serif', backgroundColor: '#F8FAFC', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  headerTitle: { fontSize: '26px', fontWeight: '800', color: '#00BFFF', margin: 0, cursor: 'pointer' },
  headerSubtitle: { fontSize: '12px', color: '#94a3b8' },
  btnAdmin: { background: '#1A237E', color: 'white', padding: '10px 14px', borderRadius: '12px', border: 'none', fontWeight: 'bold' },
  btnOut: { background: 'white', color: '#1A237E', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '12px' },
  search: { width: '100%', padding: '18px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFF', marginBottom: '30px', boxSizing: 'border-box', fontSize: '16px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '25px' },
  card: { background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', cursor: 'pointer' },
  carouselWrapper: { height: '220px', overflow: 'hidden' },
  carouselWrapperDetail: { height: '280px', overflow: 'hidden', borderRadius: '20px', marginBottom: '20px' },
  carouselContainer: { display: 'flex', overflowX: 'auto', height: '100%', scrollSnapType: 'x mandatory' },
  img: { flex: '0 0 100%', width: '100%', height: '100%', objectFit: 'cover', scrollSnapAlign: 'start' },
  cardBody: { padding: '18px' },
  cardHeaderLine: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: '20px', fontWeight: '800', margin: 0 },
  cardPrice: { fontSize: '20px', fontWeight: '800', color: '#00BFFF' },
  cardLoc: { color: '#64748b', fontSize: '13px', marginTop: '4px' },
  divider: { height: '1px', backgroundColor: '#F1F5F9', margin: '15px 0' },
  detailsRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' },
  detCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '14px' },
  techGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' },
  techItem: { fontSize: '14px', color: '#475569', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '5px' },
  promoBox: { background: '#E0F7FA', color: '#006064', padding: '10px', borderRadius: '12px', textAlign: 'center', fontWeight: '600', fontSize: '13px', marginBottom: '10px' },
  btnWa: { flex: 1, background: '#25D366', color: 'white', border: 'none', padding: '12px', borderRadius: '15px', fontWeight: 'bold' },
  btnEd: { flex: 1, background: 'white', color: '#00BFFF', border: '1px solid #00BFFF', padding: '12px', borderRadius: '15px', fontWeight: 'bold' },
  overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
  modal: { background: 'white', padding: '25px', borderRadius: '30px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' },
  detailModal: { background: 'white', padding: '30px', borderRadius: '30px', width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' },
  closeBtn: { position: 'absolute', top: '15px', right: '15px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', zIndex: 11 },
  uploadZone: { border: '2px dashed #00BFFF', borderRadius: '20px', padding: '15px', textAlign: 'center', marginBottom: '15px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  input: { padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0', width: '100%', boxSizing: 'border-box' },
  btnPrimary: { width: '100%', background: '#1A237E', color: 'white', padding: '16px', borderRadius: '15px', border: 'none', fontWeight: 'bold', fontSize: '16px' },
  btnSecondary: { width: '100%', background: 'white', color: '#1A237E', padding: '16px', borderRadius: '15px', border: '2px solid #1A237E', fontWeight: 'bold', fontSize: '16px', marginTop: '10px' },
  btnCancel: { width: '100%', background: 'none', border: 'none', color: '#64748b', marginTop: '10px' },
  loginContainer: { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC' },
  loginCard: { background: 'white', padding: '40px', borderRadius: '40px', textAlign: 'center', width: '380px' }
};