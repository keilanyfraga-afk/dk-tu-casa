import React, { useState, useEffect } from "react";
import { db, auth } from "./firebase"; 
import { collection, onSnapshot, addDoc, updateDoc, doc, getDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

// CONFIGURACIÓN DE CLOUDINARY
const CLOUD_NAME = "dp4m3p0do"; 
const UPLOAD_PRESET = "unsigned_preset"; 

export default function App() {
  const [view, setView] = useState("welcome"); // welcome, client, login, admin
  const [user, setUser] = useState(null);
  const [houses, setHouses] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
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
        setView("admin");
      } else {
        setUser(null);
      }
    });
    const unsubHouses = onSnapshot(collection(db, "houses"), (snap) => setHouses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubAuth(); unsubHouses(); };
  }, []);

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
    const msg = `*DK TU CASA*%0A📍 ${h.ubicacion}%0A🏠 *Modelo:* ${h.modelo}%0A💰 *Precio:* ${h.precio}%0A🏢 *Niveles:* ${h.niveles || '1'}%0A🛌 *Hab:* ${h.recamaras} | 🚿 *Baños:* ${h.banos}%0A📐 *T:* ${h.terreno}m2 | 🏠 *C:* ${h.construccion}m2${fotosLink}`;
    window.open(`https://wa.me/5281XXXXXXXX?text=${msg}`, "_blank");
  };

  // PANTALLA DE BIENVENIDA
  if (view === "welcome") return (
    <div style={s.loginContainer}>
      <div style={s.loginCard}>
        <h1 style={{color: '#00BFFF', fontWeight: '800', fontSize: '32px', marginBottom: '10px'}}>DK TU CASA</h1>
        <p style={{color: '#64748b', marginBottom: '30px'}}>Bienvenido a nuestro inventario exclusivo</p>
        <button onClick={() => setView("client")} style={s.btnPrimary}>Ver Catálogo (Cliente)</button>
        <button onClick={() => setView("login")} style={s.btnSecondary}>Acceso Administrativo</button>
      </div>
    </div>
  );

  // PANTALLA DE LOGIN PARA ADMIN
  if (view === "login" && !user) return (
    <div style={s.loginContainer}>
      <div style={s.loginCard}>
        <h2 style={{color: '#1A237E', marginBottom: '20px'}}>Iniciar Sesión</h2>
        <form onSubmit={(e) => { e.preventDefault(); signInWithEmailAndPassword(auth, email, password); }}>
          <input type="email" placeholder="Correo" style={s.input} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Contraseña" style={s.input} onChange={e => setPassword(e.target.value)} />
          <button style={s.btnPrimary}>Entrar</button>
          <button type="button" onClick={() => setView("welcome")} style={{background: 'none', border: 'none', marginTop: '15px', color: '#64748b'}}>Volver</button>
        </form>
      </div>
    </div>
  );

  return (
    <div style={s.container}>
      <header style={s.header}>
        <div style={{flex: 1}}>
          <h1 style={s.headerTitle} onClick={() => setView("welcome")}>DK TU CASA</h1>
          <p style={s.headerSubtitle}>{user ? `Panel: ${user.email}` : "Catálogo Público"}</p>
        </div>
        <div style={{display: 'flex', gap: '8px'}}>
          {user?.role === 'admin' && <button onClick={() => setShowModal(true)} style={s.btnAdmin}>+ Nueva Propiedad</button>}
          {user && <button onClick={() => signOut(auth).then(() => setView("welcome"))} style={s.btnOut}>Salir</button>}
          {!user && <button onClick={() => setView("welcome")} style={s.btnOut}>Menú</button>}
        </div>
      </header>

      {/* BARRA DE BUSQUEDA BLANCA */}
      <input placeholder="Buscar por modelo, zona, precio..." style={s.search} onChange={e => setSearch(e.target.value)} />

      <div style={s.grid}>
        {houses.filter(h => h.modelo.toLowerCase().includes(search.toLowerCase())).map(h => (
          <div key={h.id} style={s.card}>
            <div style={s.carouselWrapper}>
              <div style={s.carouselContainer}>
                {(h.imagenes && h.imagenes.length > 0) ? h.imagenes.map((img, idx) => (
                  <img key={idx} src={img} style={s.img} alt={`Foto ${idx}`} />
                )) : <img src="https://via.placeholder.com/400x250?text=DK+TU+CASA" style={s.img} />}
              </div>
              {h.imagenes?.length > 1 && <div style={s.carouselHint}>Desliza para ver {h.imagenes.length} fotos ↔️</div>}
            </div>

            <div style={s.cardBody}>
              <div style={s.cardHeaderLine}>
                <h2 style={s.cardTitle}>{h.modelo}</h2>
                <span style={s.cardPrice}>${h.precio}</span>
              </div>
              <p style={s.cardLoc}>📍 {h.ubicacion}</p>
              <div style={s.divider}></div>
              <div style={s.detailsRow}>
                <div style={s.detCol}><strong>{h.recamaras}</strong><small>Hab.</small></div>
                <div style={s.detCol}><strong>{h.banos}</strong><small>Baños</small></div>
                <div style={s.detCol}><strong>{h.niveles || '1'}</strong><small>Niv.</small></div>
                <div style={s.detCol}><strong>{h.terreno}m2</strong><small>T. m²</small></div>
              </div>
              {h.promocion && <div style={s.promoBox}>🎁 {h.promocion}</div>}
              <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
                <button onClick={() => sendWhatsApp(h)} style={s.btnWa}>WhatsApp</button>
                {user?.role === 'admin' && <button onClick={() => {setEditing(h); setShowModal(true)}} style={s.btnEd}>Editar</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={s.overlay}>
          <form onSubmit={saveHouse} style={s.modal}>
            <h3 style={{marginBottom: '15px'}}>{editing ? "Editar Propiedad" : "Nueva Propiedad"}</h3>
            <div style={s.uploadZone}>
              <input type="file" accept="image/*" onChange={handleUpload} />
              {uploading && <p style={{color: '#00BFFF', fontSize: '12px'}}>Subiendo... ⏳</p>}
              <p style={{fontSize: '11px'}}>Fotos actuales: {tempImages.length + (editing?.imagenes?.length || 0)}</p>
            </div>
            <div style={s.formGrid}>
              <input name="modelo" placeholder="Modelo" defaultValue={editing?.modelo} required style={s.input} />
              <input name="ubicacion" placeholder="Ubicación" defaultValue={editing?.ubicacion} required style={s.input} />
              <input name="precio" placeholder="Precio" defaultValue={editing?.precio} required style={s.input} />
              <input name="promocion" placeholder="Promoción" defaultValue={editing?.promocion} style={s.input} />
              <input name="recamaras" placeholder="Habitaciones" defaultValue={editing?.recamaras} style={s.input} />
              <input name="banos" placeholder="Baños" defaultValue={editing?.banos} style={s.input} />
              <input name="niveles" placeholder="Niveles" defaultValue={editing?.niveles} style={s.input} />
              <input name="terreno" placeholder="Terreno m2" defaultValue={editing?.terreno} style={s.input} />
              <input name="construccion" placeholder="Construcción m2" defaultValue={editing?.construccion} style={s.input} />
            </div>
            <button type="submit" style={s.btnPrimary}>{uploading ? "Cargando..." : "Guardar"}</button>
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
  btnOut: { background: 'white', color: '#64748b', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '12px', fontWeight: 'bold' },
  
  // BUSCADOR BLANCO
  search: { width: '100%', padding: '18px', borderRadius: '20px', border: '1px solid #E2E8F0', background: '#FFF', color: '#333', marginBottom: '30px', boxSizing: 'border-box', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', fontSize: '16px' },
  
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '25px' },
  card: { background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' },
  carouselWrapper: { position: 'relative', height: '240px', overflow: 'hidden' },
  carouselContainer: { display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', height: '100%' },
  img: { flex: '0 0 100%', width: '100%', height: '100%', objectFit: 'cover', scrollSnapAlign: 'start' },
  carouselHint: { position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '10px' },
  cardBody: { padding: '20px' },
  cardHeaderLine: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: '20px', fontWeight: '800', margin: 0 },
  cardPrice: { fontSize: '20px', fontWeight: '800', color: '#00BFFF' },
  cardLoc: { color: '#64748b', fontSize: '13px', marginTop: '4px' },
  divider: { height: '1px', backgroundColor: '#F1F5F9', margin: '15px 0' },
  detailsRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' },
  detCol: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  promoBox: { background: '#E0F7FA', color: '#006064', padding: '10px', borderRadius: '12px', textAlign: 'center', fontWeight: '600', fontSize: '13px' },
  btnWa: { flex: 1, background: '#25D366', color: 'white', border: 'none', padding: '12px', borderRadius: '15px', fontWeight: 'bold', fontSize: '14px' },
  btnEd: { flex: 1, background: 'white', color: '#00BFFF', border: '1px solid #00BFFF', padding: '12px', borderRadius: '15px', fontWeight: 'bold' },
  overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
  modal: { background: 'white', padding: '30px', borderRadius: '30px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' },
  uploadZone: { border: '2px dashed #00BFFF', borderRadius: '20px', padding: '20px', textAlign: 'center', marginBottom: '20px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  input: { padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0', width: '100%', boxSizing: 'border-box', marginBottom: '10px' },
  btnPrimary: { width: '100%', background: '#1A237E', color: 'white', padding: '16px', borderRadius: '15px', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' },
  btnSecondary: { width: '100%', background: 'white', color: '#1A237E', padding: '16px', borderRadius: '15px', border: '2px solid #1A237E', fontWeight: 'bold', fontSize: '16px', marginTop: '12px', cursor: 'pointer' },
  btnCancel: { width: '100%', background: 'none', border: 'none', color: '#64748b', marginTop: '10px' },
  loginContainer: { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC' },
  loginCard: { background: 'white', padding: '50px 40px', borderRadius: '40px', textAlign: 'center', width: '380px', boxShadow: '0 20px 40px rgba(0,0,0,0.05)' }
};