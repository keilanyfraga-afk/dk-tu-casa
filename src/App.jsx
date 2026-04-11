import React, { useState, useEffect } from "react";
import { db, auth } from "./firebase"; 
import { collection, onSnapshot, addDoc, updateDoc, doc, getDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);

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
    return () => { unsubAuth(); unsubHouses(); window.removeEventListener("resize", handleResize); };
  }, []);

  useEffect(() => {
    const term = search.toLowerCase();
    const results = houses.filter(h => {
      const modelo = h.modelo?.toLowerCase() || "";
      const ubicacion = h.ubicacion?.toLowerCase() || "";
      const precio = h.precio?.toString().toLowerCase() || "";
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

  const sendWhatsAppFicha = (h) => {
    const fotosLink = h.imagenes?.map((img, i) => `%0A📸 Foto ${i+1}: ${img}`).join('') || '';
    const msg = `*DK TU CASA INMOBILIARIA*%0A📍 ${h.ubicacion.toUpperCase()}%0A🏠 *Modelo:* ${h.modelo.toUpperCase()}%0A💰 *Precio:* ${h.precio}%0A🏢 *Niveles:* ${h.niveles || '1'}%0A🛌 *Hab:* ${h.recamaras} | 🚿 *Baños:* ${h.banos}%0A📐 *T:* ${h.terreno} m2 | 🏠 *C:* ${h.construccion} m2${fotosLink}`;
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const sendWhatsAppDirecto = (h) => {
    const msg = `Hola DK Inmobiliaria! Me interesa obtener información sobre la casa *Modelo ${h.modelo.toUpperCase()}* en *${h.ubicacion.toUpperCase()}*.`;
    window.open(`https://wa.me/528140099029?text=${msg}`, "_blank");
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
            <h1 style={isMobile ? s.headerTitleMobile : s.headerTitlePC} onClick={() => setView("welcome")}>DK TU CASA</h1>
            <p style={s.headerSubtitle}>{user ? `Hola, ${user.email}` : "Catálogo para Clientes"}</p>
        </div>
        <div style={{display: 'flex', gap: '8px'}}>
          {user?.role === 'admin' && <button onClick={() => setShowModal(true)} style={s.btnAdmin}>+</button>}
          {user ? <button onClick={() => signOut(auth).then(() => setView("welcome"))} style={s.btnOut}>Salir</button> : <button onClick={() => setView("welcome")} style={s.btnOut}>Menú</button>}
        </div>
      </header>

      <input placeholder="Buscar por modelo, zona, precio..." style={s.search} value={search} onChange={e => setSearch(e.target.value)} />

      <div style={{...s.grid, gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(100%, 1fr))' : 'repeat(auto-fill, minmax(350px, 1fr))'}}>
        {filteredHouses.map(h => (
          <div key={h.id} style={s.card} onClick={() => setSelectedHouse(h)}>
            <div style={s.carouselWrapper}>
                <div style={s.carouselContainer}>
                    {h.imagenes?.map((img, idx) => <img key={idx} src={img} style={s.img} alt="" />)}
                </div>
                {h.imagenes?.length > 1 && (
                    <div style={s.carouselHint}>
                        Desliza ↔️ {h.imagenes.length} fotos más
                    </div>
                )}
            </div>
            <div style={s.cardBody}>
              <div style={s.cardHeaderLine}><h2 style={s.cardTitle}>{h.modelo}</h2><span style={s.cardPrice}>${h.precio}</span></div>
              <p style={s.cardLoc}>📍 {h.ubicacion}</p>
              <div style={s.divider}></div>
              <div style={s.detailsRow}>
                <div style={s.detCol}><strong>{h.recamaras}</strong>Hab.</div>
                <div style={s.detCol}><strong>{h.banos}</strong>Baños</div>
                <div style={s.detCol}><strong>{h.terreno}m2</strong>T. m²</div>
              </div>
              {h.promocion && <div style={s.promoBox}>🎁 {h.promocion}</div>}
              <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
                <button onClick={(e) => { e.stopPropagation(); sendWhatsAppFicha(h); }} style={s.btnWa}>WhatsApp</button>
                {user?.role === 'admin' && <button onClick={(e) => { e.stopPropagation(); setEditing(h); setShowModal(true); }} style={s.btnEd}>Editar</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedHouse && (
        <div style={s.overlay} onClick={() => setSelectedHouse(null)}>
          <div style={isMobile ? s.detailModalMobile : s.detailModalPC} onClick={e => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setSelectedHouse(null)}>✕</button>
            <div style={s.carouselWrapperDetail}>
                <div style={s.carouselContainer}>
                    {selectedHouse.imagenes?.map((img, idx) => <img key={idx} src={img} style={s.img} alt="" />)}
                </div>
            </div>
            <h2 style={s.cardTitle}>{selectedHouse.modelo}</h2>
            <h3 style={s.cardPrice}>${selectedHouse.precio}</h3>
            <p style={s.cardLoc}>📍 {selectedHouse.ubicacion}</p>
            <div style={s.divider}></div>
            <div style={s.techGrid}>
                <div style={s.techItem}><span>Niveles:</span> <strong>{selectedHouse.niveles || "1"}</strong></div>
                <div style={s.techItem}><span>Hab:</span> <strong>{selectedHouse.recamaras || "0"}</strong></div>
                <div style={s.techItem}><span>Baños:</span> <strong>{selectedHouse.banos || "0"}</strong></div>
                <div style={s.techItem}><span>Terreno:</span> <strong>{selectedHouse.terreno}m²</strong></div>
                <div style={s.techItem}><span>Const:</span> <strong>{selectedHouse.construccion}m²</strong></div>
            </div>
            <div style={s.divider}></div>
            <p><strong>Descripción:</strong><br/>{selectedHouse.descripcion || "Sin descripción."}</p>
            {/* NOMBRE CAMBIADO A AMENIDADES ABAJO */}
            <p><strong>Amenidades:</strong><br/>{selectedHouse.amenidades || "N/A"}</p>
            <div style={s.contactAlert}>
                Para más información contacta con tu asesor o con DK: <br/>
                <span onClick={() => sendWhatsAppDirecto(selectedHouse)} style={{color: '#00BFFF', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold'}}>
                   [Click aquí para preguntar]
                </span>
            </div>
            <button onClick={() => sendWhatsAppFicha(selectedHouse)} style={{...s.btnWa, width: '100%'}}>WhatsApp</button>
          </div>
        </div>
      )}

      {showModal && (
        <div style={s.overlay}>
          <form onSubmit={saveHouse} style={isMobile ? s.modalMobile : s.modalPC}>
            <h3 style={{marginBottom: '15px'}}>{editing ? "Editar" : "Nueva Propiedad"}</h3>
            <div style={s.uploadZone}>
                <input type="file" accept="image/*" onChange={handleUpload} style={{width: '100%'}} />
                <p style={{fontSize: '11px'}}>Fotos: {tempImages.length + (editing?.imagenes?.length || 0)}</p>
            </div>
            <div style={s.formGrid}>
              <input name="modelo" placeholder="Modelo" defaultValue={editing?.modelo} required style={s.input} />
              <input name="ubicacion" placeholder="Ubicación" defaultValue={editing?.ubicacion} required style={s.input} />
              <input name="precio" placeholder="Precio" defaultValue={editing?.precio} required style={s.input} />
              <input name="promocion" placeholder="Promoción" defaultValue={editing?.promocion} style={s.input} />
              <input name="recamaras" placeholder="Hab" defaultValue={editing?.recamaras} style={s.input} />
              <input name="banos" placeholder="Baños" defaultValue={editing?.banos} style={s.input} />
              <input name="niveles" placeholder="Niv" defaultValue={editing?.niveles} style={s.input} />
              <input name="terreno" placeholder="T. m2" defaultValue={editing?.terreno} style={s.input} />
              <input name="construccion" placeholder="C. m2" defaultValue={editing?.construccion} style={s.input} />
              <textarea name="amenidades" placeholder="Amenidades..." defaultValue={editing?.amenidades} style={{...s.input, gridColumn: 'span 2', height: '40px'}} />
              <textarea name="descripcion" placeholder="Descripción..." defaultValue={editing?.descripcion} style={{...s.input, gridColumn: 'span 2', height: '60px'}} />
            </div>
            <button type="submit" style={s.btnPrimary}>Guardar</button>
            <button type="button" onClick={() => {setShowModal(false); setTempImages([]); setEditing(null)}} style={s.btnCancel}>Cancelar</button>
          </form>
        </div>
      )}
    </div>
  );
}

const s = {
  container: { padding: '15px', maxWidth: '1200px', margin: '0 auto', fontFamily: '-apple-system, sans-serif', backgroundColor: '#F8FAFC', minHeight: '100vh', overflowX: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
  headerTitlePC: { fontSize: '28px', fontWeight: '800', color: '#00BFFF', margin: 0 },
  headerTitleMobile: { fontSize: '20px', fontWeight: '800', color: '#00BFFF', margin: 0 },
  headerSubtitle: { fontSize: '10px', color: '#94a3b8' },
  btnAdmin: { background: '#1A237E', color: 'white', padding: '8px 12px', borderRadius: '10px', border: 'none', fontWeight: 'bold' },
  btnOut: { background: 'white', color: '#1A237E', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '12px' },
  search: { width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #E2E8F0', background: '#FFF', marginBottom: '20px', fontSize: '16px', boxSizing: 'border-box' },
  grid: { display: 'grid', gap: '25px' },
  card: { background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 5px 15px rgba(0,0,0,0.05)', cursor: 'pointer', display: 'flex', flexDirection: 'column' },
  carouselWrapper: { height: '220px', overflow: 'hidden', position: 'relative' },
  carouselWrapperDetail: { height: '280px', overflow: 'hidden', borderRadius: '20px', marginBottom: '15px' },
  carouselContainer: { display: 'flex', overflowX: 'auto', height: '100%', scrollSnapType: 'x mandatory' },
  img: { flex: '0 0 100%', width: '100%', height: '100%', objectFit: 'cover', scrollSnapAlign: 'start' },
  carouselHint: { position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 10px', borderRadius: '15px', fontSize: '10px' },
  cardBody: { padding: '18px', flex: 1, display: 'flex', flexDirection: 'column' },
  cardHeaderLine: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: '18px', fontWeight: '800', margin: 0 },
  cardPrice: { fontSize: '18px', fontWeight: '800', color: '#00BFFF' },
  cardLoc: { color: '#64748b', fontSize: '12px', marginTop: '4px' },
  divider: { height: '1px', backgroundColor: '#F1F5F9', margin: '10px 0' },
  detailsRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' },
  detCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '12px' },
  techGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' },
  techItem: { fontSize: '13px', color: '#475569', display: 'flex', justifyContent: 'space-between' },
  promoBox: { background: '#E0F7FA', color: '#006064', padding: '8px', borderRadius: '10px', textAlign: 'center', fontWeight: '600', fontSize: '12px', marginBottom: '10px' },
  contactAlert: { background: '#F1F5F9', color: '#475569', padding: '10px', borderRadius: '10px', textAlign: 'center', fontSize: '12px', marginBottom: '10px' },
  btnWa: { flex: 1, background: '#25D366', color: 'white', border: 'none', padding: '12px', borderRadius: '15px', fontWeight: 'bold', fontSize: '13px' },
  btnEd: { flex: 1, background: 'white', color: '#00BFFF', border: '1px solid #00BFFF', padding: '12px', borderRadius: '15px', fontWeight: 'bold' },
  overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalMobile: { background: 'white', padding: '20px', borderRadius: '25px', width: '90%', maxHeight: '90vh', overflowY: 'auto' },
  modalPC: { background: 'white', padding: '25px', borderRadius: '25px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' },
  detailModalMobile: { background: 'white', padding: '20px', borderRadius: '25px', width: '90%', maxHeight: '90vh', overflowY: 'auto', position: 'relative' },
  detailModalPC: { background: 'white', padding: '30px', borderRadius: '25px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' },
  closeBtn: { position: 'absolute', top: '10px', right: '10px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '25px', height: '25px', zIndex: 11 },
  uploadZone: { border: '2px dashed #00BFFF', borderRadius: '15px', padding: '10px', textAlign: 'center', marginBottom: '10px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  input: { padding: '10px', borderRadius: '10px', border: '1px solid #E2E8F0', width: '100%', boxSizing: 'border-box' },
  btnPrimary: { width: '100%', background: '#1A237E', color: 'white', padding: '14px', borderRadius: '12px', border: 'none', fontWeight: 'bold', marginTop: '10px' },
  btnSecondary: { width: '100%', background: 'white', color: '#1A237E', padding: '14px', borderRadius: '12px', border: '2px solid #1A237E', fontWeight: 'bold', marginTop: '10px' },
  btnCancel: { width: '100%', background: 'none', border: 'none', color: '#64748b', marginTop: '10px' },
  loginContainer: { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC' },
  loginCard: { background: 'white', padding: '30px', borderRadius: '30px', textAlign: 'center', width: '85%', maxWidth: '380px' }
};