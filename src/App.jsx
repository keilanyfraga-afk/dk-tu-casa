import React, { useState, useEffect } from "react";
import { db, auth } from "./firebase"; 
import { collection, onSnapshot, addDoc, updateDoc, doc, getDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

// CONFIGURACIÓN DE CLOUDINARY
const CLOUD_NAME = "dp4m3p0do"; 
const UPLOAD_PRESET = "unsigned_preset"; 

export default function App() {
  const [user, setUser] = useState(null);
  const [houses, setHouses] = useState([]);
  const [filteredHouses, setFilteredHouses] = useState([]); // Lógica de búsqueda
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
        try {
          const userSnap = await getDoc(doc(db, "users", currentUser.email.toLowerCase().trim()));
          setUser({ email: currentUser.email, role: (userSnap.exists() && userSnap.data().role === "admin") ? "admin" : "asesor" });
        } catch (e) { setUser({ email: currentUser.email, role: "asesor" }); }
      } else { setUser(null); }
    });

    const unsubHouses = onSnapshot(collection(db, "houses"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setHouses(list);
      setFilteredHouses(list);
    });
    return () => { unsubAuth(); unsubHouses(); };
  }, []);

  // ESTA FUNCIÓN HACE QUE LA BARRA DE BÚSQUEDA SIRVA
  useEffect(() => {
    const results = houses.filter(h => 
      h.modelo?.toLowerCase().includes(search.toLowerCase()) ||
      h.ubicacion?.toLowerCase().includes(search.toLowerCase()) ||
      h.precio?.toString().includes(search)
    );
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

  if (!user) return (
    <div style={s.loginContainer}>
      <div style={s.loginCard}>
        <h2 style={{color: '#00BFFF', fontWeight: '800'}}>DK TU CASA</h2>
        <form onSubmit={(e) => { e.preventDefault(); signInWithEmailAndPassword(auth, email, password); }}>
          <input type="email" placeholder="Correo" style={s.input} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Contraseña" style={s.input} onChange={e => setPassword(e.target.value)} />
          <button style={s.btnPrimary}>Entrar al Sistema</button>
        </form>
      </div>
    </div>
  );

  return (
    <div style={s.container}>
      <header style={s.header}>
        <div style={{flex: 1}}>
          <h1 style={{color: '#00BFFF', fontWeight: '800', margin: 0}}>DK TU CASA</h1>
          <p style={{color: '#64748b', fontSize: '12px'}}>Inventario | Hola, {user.email}</p>
        </div>
        <div style={{display: 'flex', gap: '8px'}}>
          {user.role === 'admin' && <button onClick={() => setShowModal(true)} style={s.btnAdmin}>+ Nueva Propiedad</button>}
          <button onClick={() => signOut(auth)} style={s.btnOut}>Cerrar Sesión</button>
        </div>
      </header>

      {/* BARRA DE BÚSQUEDA BLANCA Y FUNCIONAL */}
      <input 
        placeholder="Buscar por modelo, zona, precio..." 
        style={s.search} 
        value={search}
        onChange={e => setSearch(e.target.value)} 
      />

      <div style={s.grid}>
        {filteredHouses.map(h => (
          <div key={h.id} style={s.card}>
            <img src={h.imagenes?.[0] || "https://via.placeholder.com/400x250?text=DK+TU+CASA"} style={s.img} />
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
                <div style={s.detCol}><strong>{h.terreno}m2</strong><small>T. m²</small></div>
                <div style={s.detCol}><strong>{h.construccion}m2</strong><small>C. m²</small></div>
              </div>

              {h.promocion && <div style={s.promoBox}>🎁 Promoción: {h.promocion}</div>}

              {user.role === 'admin' && (
                <button onClick={() => {setEditing(h); setShowModal(true)}} style={s.btnEd}>Editar Información</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={s.overlay}>
          <form onSubmit={saveHouse} style={s.modal}>
            <h3>{editing ? "Editar Propiedad" : "Nueva Propiedad"}</h3>
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
              <input name="terreno" placeholder="Terreno m2" defaultValue={editing?.terreno} style={s.input} />
              <input name="construccion" placeholder="Construcción m2" defaultValue={editing?.construccion} style={s.input} />
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
  container: { padding: '20px 15px', maxWidth: '1200px', margin: '0 auto', fontFamily: '-apple-system, sans-serif', backgroundColor: '#F8FAFC' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  btnAdmin: { background: '#1A237E', color: 'white', padding: '10px 15px', borderRadius: '10px', border: 'none', fontWeight: 'bold' },
  btnOut: { background: 'white', color: '#1A237E', padding: '10px 15px', border: '1px solid #E2E8F0', borderRadius: '10px', fontWeight: 'bold' },
  // BUSCADOR BLANCO
  search: { width: '100%', padding: '16px', borderRadius: '15px', border: '1px solid #E2E8F0', background: '#FFF', color: '#333', marginBottom: '30px', boxSizing: 'border-box', fontSize: '16px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '25px' },
  card: { background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' },
  img: { width: '100%', height: '230px', objectFit: 'cover' },
  cardBody: { padding: '20px' },
  cardHeaderLine: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: '22px', fontWeight: '800', margin: 0 },
  cardPrice: { fontSize: '22px', fontWeight: '800', color: '#00BFFF' },
  cardLoc: { color: '#64748b', fontSize: '14px', marginTop: '4px' },
  divider: { height: '1px', backgroundColor: '#F1F5F9', margin: '15px 0' },
  detailsRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' },
  detCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '14px' },
  promoBox: { background: '#E0F7FA', color: '#006064', padding: '10px', borderRadius: '12px', textAlign: 'center', fontWeight: '600', fontSize: '14px', marginBottom: '15px' },
  btnEd: { width: '100%', background: 'white', color: '#00BFFF', border: '1px solid #00BFFF', padding: '12px', borderRadius: '12px', fontWeight: 'bold' },
  overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { background: 'white', padding: '25px', borderRadius: '25px', width: '95%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' },
  uploadZone: { border: '2px dashed #00BFFF', borderRadius: '15px', padding: '15px', textAlign: 'center', marginBottom: '15px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  input: { padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', width: '100%', boxSizing: 'border-box' },
  btnPrimary: { width: '100%', background: '#1A237E', color: 'white', padding: '15px', borderRadius: '15px', border: 'none', fontWeight: 'bold', marginTop: '15px' },
  btnCancel: { width: '100%', background: 'none', border: 'none', color: '#64748b', marginTop: '10px' },
  loginContainer: { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F1F5F9' },
  loginCard: { background: 'white', padding: '40px', borderRadius: '30px', textAlign: 'center', width: '350px' }
};