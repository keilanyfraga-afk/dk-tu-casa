import React, { useState, useEffect } from "react";
import { db, auth } from "./firebase"; 
import { collection, onSnapshot, addDoc, updateDoc, doc, getDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

// CONFIGURACIÓN DE CLOUDINARY (CAMBIA ESTO)
const CLOUD_NAME = "dp4m3p0do"; 
const UPLOAD_PRESET = "unsigned_preset"; 

export default function App() {
  const [user, setUser] = useState(null);
  const [houses, setHouses] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
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
    const unsubHouses = onSnapshot(collection(db, "houses"), (snap) => setHouses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubAuth(); unsubHouses(); };
  }, []);

  // SUBIR FOTOS A CLOUDINARY (GRATIS)
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
    // Guardamos todas las fotos subidas
    data.imagenes = editing ? [...(editing.imagenes || []), ...tempImages] : tempImages;

    try {
      if (editing) await updateDoc(doc(db, "houses", editing.id), data);
      else await addDoc(collection(db, "houses"), data);
      setTempImages([]); setShowModal(false); setEditing(null);
    } catch (err) { alert("Error al guardar"); }
  };

  const sendWhatsApp = (h) => {
    const msg = `*DK TU CASA*%0A📍 ${h.ubicacion}%0A🏠 Modelo: ${h.modelo}%0A💰 Precio: ${h.precio}%0A📸 Fotos: ${h.imagenes?.join(', ')}`;
    window.open(`https://wa.me/5281XXXXXXXX?text=${msg}`, "_blank"); // Cambia el número
  };

  if (!user) return (
    <div style={s.loginContainer}>
      <div style={s.loginCard}>
        <h2 style={{color: '#00BFFF'}}>DK TU CASA</h2>
        <form onSubmit={(e) => { e.preventDefault(); signInWithEmailAndPassword(auth, email, password); }}>
          <input type="email" placeholder="Correo" style={s.input} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Contraseña" style={s.input} onChange={e => setPassword(e.target.value)} />
          <button style={s.btnPrimary}>Entrar</button>
        </form>
      </div>
    </div>
  );

  return (
    <div style={s.container}>
      <header style={s.header}>
        <h1 style={{color: '#00BFFF', fontWeight: '800'}}>DK TU CASA</h1>
        <div>
          {user.role === 'admin' && <button onClick={() => setShowModal(true)} style={s.btnAdmin}>+ Nueva Casa</button>}
          <button onClick={() => signOut(auth)} style={s.btnOut}>Salir</button>
        </div>
      </header>

      <input placeholder="Buscar casa..." style={s.search} onChange={e => setSearch(e.target.value)} />

      <div style={s.grid}>
        {houses.filter(h => h.modelo.toLowerCase().includes(search.toLowerCase())).map(h => (
          <div key={h.id} style={s.card}>
            <div style={s.imgContainer}>
              <img src={h.imagenes?.[0]} style={s.img} />
              <span style={s.priceTag}>${h.precio}</span>
            </div>
            <div style={s.content}>
              <h3 style={{margin: '0 0 5px 0'}}>{h.modelo}</h3>
              <p style={{fontSize: '13px', color: '#64748b'}}>📍 {h.ubicacion}</p>
              <div style={s.details}>
                <span>🛏️ {h.recamaras}</span><span>🚿 {h.banos}</span><span>📐 {h.terreno}m²</span>
              </div>
              <div style={{display: 'flex', gap: '8px'}}>
                <button onClick={() => sendWhatsApp(h)} style={s.btnWa}>WhatsApp</button>
                {user.role === 'admin' && <button onClick={() => {setEditing(h); setShowModal(true)}} style={s.btnEd}>Editar</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={s.overlay}>
          <form onSubmit={saveHouse} style={s.modal}>
            <h3>{editing ? "Editar" : "Nueva Propiedad"}</h3>
            <div style={{border: '2px dashed #00BFFF', padding: '10px', textAlign: 'center', marginBottom: '15px'}}>
              <input type="file" accept="image/*" onChange={handleUpload} />
              {uploading && <p>Subiendo foto... ⏳</p>}
              <p>Fotos listas: {tempImages.length + (editing?.imagenes?.length || 0)}</p>
            </div>
            <div style={s.formGrid}>
              <input name="modelo" placeholder="Modelo" defaultValue={editing?.modelo} required style={s.input} />
              <input name="ubicacion" placeholder="Ubicación" defaultValue={editing?.ubicacion} required style={s.input} />
              <input name="precio" placeholder="Precio" defaultValue={editing?.precio} required style={s.input} />
              <input name="recamaras" placeholder="Recámaras" defaultValue={editing?.recamaras} style={s.input} />
              <input name="banos" placeholder="Baños" defaultValue={editing?.banos} style={s.input} />
              <input name="terreno" placeholder="Terreno m²" defaultValue={editing?.terreno} style={s.input} />
            </div>
            <button type="submit" style={s.btnPrimary}>{uploading ? "Espera..." : "Guardar Todo"}</button>
            <button type="button" onClick={() => {setShowModal(false); setTempImages([]); setEditing(null)}} style={{width: '100%', background: 'none', border: 'none', marginTop: '10px'}}>Cancelar</button>
          </form>
        </div>
      )}
    </div>
  );
}

const s = {
  container: { padding: '30px 15px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#F8FAFC' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  btnAdmin: { background: '#1A237E', color: 'white', padding: '10px 15px', borderRadius: '10px', border: 'none', fontWeight: 'bold' },
  btnOut: { background: 'none', color: '#64748b', border: 'none', marginLeft: '10px' },
  search: { width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #E2E8F0', marginBottom: '30px', fontSize: '16px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px' },
  card: { background: 'white', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' },
  imgContainer: { position: 'relative', height: '200px' },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  priceTag: { position: 'absolute', bottom: '10px', left: '10px', background: '#00BFFF', color: 'white', padding: '5px 12px', borderRadius: '8px', fontWeight: 'bold' },
  content: { padding: '15px' },
  details: { display: 'flex', justifyContent: 'space-between', margin: '15px 0', fontSize: '14px', color: '#475569' },
  btnWa: { flex: 1, background: '#25D366', color: 'white', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' },
  btnEd: { background: '#f1f5f9', border: '1px solid #ddd', padding: '10px', borderRadius: '10px' },
  overlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { background: 'white', padding: '25px', borderRadius: '25px', width: '90%', maxWidth: '500px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  input: { padding: '12px', borderRadius: '10px', border: '1px solid #ddd', width: '100%', boxSizing: 'border-box', marginBottom: '10px' },
  btnPrimary: { width: '100%', background: '#1A237E', color: 'white', padding: '14px', borderRadius: '12px', border: 'none', fontWeight: 'bold' },
  loginContainer: { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f1f5f9' },
  loginCard: { background: 'white', padding: '40px', borderRadius: '25px', textAlign: 'center', width: '350px' }
};
