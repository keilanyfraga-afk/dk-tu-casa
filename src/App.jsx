import React, { useState, useEffect } from "react";
import { db, auth } from "./firebase"; 
import { collection, onSnapshot, addDoc, updateDoc, doc, getDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

export default function App() {
  const [user, setUser] = useState(null);
  const [houses, setHouses] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const cleanEmail = currentUser.email.toLowerCase().trim();
          const userSnap = await getDoc(doc(db, "users", cleanEmail));
          if (userSnap.exists() && userSnap.data().role === "admin") {
            setUser({ email: currentUser.email, role: "admin" });
          } else {
            setUser({ email: currentUser.email, role: "asesor" });
          }
        } catch (error) {
          setUser({ email: currentUser.email, role: "asesor" });
        }
      } else {
        setUser(null);
      }
    });

    const unsubHouses = onSnapshot(collection(db, "houses"), (snapshot) => {
      setHouses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubAuth(); unsubHouses(); };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      await signInWithEmailAndPassword(auth, email.toLowerCase().trim(), password);
    } catch (err) {
      setLoginError("Acceso denegado. Verifica tus datos.");
    }
  };

  const handleLogout = () => signOut(auth);

  const saveHouse = async (e) => {
    e.preventDefault();
    const houseData = Object.fromEntries(new FormData(e.target));
    try {
      if (editing) {
        await updateDoc(doc(db, "houses", editing.id), houseData);
      } else {
        await addDoc(collection(db, "houses"), houseData);
      }
      setShowModal(false);
      setEditing(null);
    } catch (err) { alert("Error al guardar datos."); }
  };

  // PANTALLA DE INICIO DE SESIÓN
  if (!user) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <div style={styles.logoPlaceholder}>DK TU CASA</div>
          <h2 style={styles.loginTitle}>Panel de Inventario</h2>
          <p style={styles.loginSubtitle}>Inicia sesión para continuar</p>
          <form onSubmit={handleLogin}>
            <input type="email" placeholder="Correo electrónico" style={styles.inputFull} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Contraseña" style={styles.inputFull} onChange={(e) => setPassword(e.target.value)} required />
            {loginError && <p style={styles.errorMessage}>{loginError}</p>}
            <button type="submit" style={styles.btnPrimaryFull}>Entrar al Sistema</button>
          </form>
        </div>
      </div>
    );
  }

  // PANTALLA PRINCIPAL
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>DK TU CASA</h1>
          <p style={styles.headerSubtitle}>Inventario de Propiedades | Hola, {user.email}</p>
        </div>
        <div style={{display: 'flex', gap: '12px'}}>
          {user.role === 'admin' && (
            <button onClick={() => {setEditing(null); setShowModal(true)}} style={styles.btnHeader}>+ Nueva Propiedad</button>
          )}
          <button onClick={handleLogout} style={styles.btnOutline}>Cerrar Sesión</button>
        </div>
      </header>

      <input type="text" placeholder="Buscar por modelo, zona, precio..." style={styles.searchInput} onChange={(e) => setSearch(e.target.value)} />

      {/* GRID DE PROPIEDADES ESTILO REFERENCIA */}
      <div style={styles.grid}>
        {houses.filter(h => `${h.modelo} ${h.ubicacion} ${h.precio}`.toLowerCase().includes(search.toLowerCase())).map(house => (
          <div key={house.id} style={styles.card}>
            <img src={house.imagen || "https://via.placeholder.com/400x250?text=DK+TU+CASA"} style={styles.cardImage} alt="Casa" />
            <div style={styles.cardContent}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>{house.modelo}</h2>
                <span style={styles.cardPrice}>${house.precio}</span>
              </div>
              <p style={styles.cardLocation}>📍 {house.ubicacion}</p>
              
              <div style={styles.cardDivider}></div>

              <div style={styles.detailsGrid}>
                <div style={styles.detailItem}><strong>{house.recamaras}</strong> <small>Hab.</small></div>
                <div style={styles.detailItem}><strong>{house.banos}</strong> <small>Baños</small></div>
                <div style={styles.detailItem}><strong>{house.terreno}</strong> <small>T. m²</small></div>
                <div style={styles.detailItem}><strong>{house.construccion}</strong> <small>C. m²</small></div>
              </div>

              {house.promocion && (
                <div style={styles.cardPromo}>🎁 Promoción: {house.promocion}</div>
              )}

              {user.role === 'admin' && (
                <button onClick={() => { setEditing(house); setShowModal(true); }} style={styles.btnCardEdit}>Editar Información</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL DE EDICIÓN/REGISTRO */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <form onSubmit={saveHouse} style={styles.modalForm}>
            <h3 style={styles.modalTitle}>Detalles de la Propiedad</h3>
            <div style={styles.formGrid}>
                <div style={styles.inputGroup}><label>Modelo</label><input name="modelo" defaultValue={editing?.modelo} required style={styles.inputField} /></div>
                <div style={styles.inputGroup}><label>Ubicación</label><input name="ubicacion" defaultValue={editing?.ubicacion} required style={styles.inputField} /></div>
                <div style={styles.inputGroup}><label>Precio</label><input name="precio" defaultValue={editing?.precio} required style={styles.inputField} /></div>
                <div style={styles.inputGroup}><label>Promoción</label><input name="promocion" defaultValue={editing?.promocion} style={styles.inputField} /></div>
                <div style={styles.inputGroup}><label>Recámaras</label><input name="recamaras" defaultValue={editing?.recamaras} style={styles.inputField} /></div>
                <div style={styles.inputGroup}><label>Baños</label><input name="banos" defaultValue={editing?.banos} style={styles.inputField} /></div>
                <div style={styles.inputGroup}><label>Terreno m²</label><input name="terreno" defaultValue={editing?.terreno} style={styles.inputField} /></div>
                <div style={styles.inputGroup}><label>Construcción m²</label><input name="construccion" defaultValue={editing?.construccion} style={styles.inputField} /></div>
                <div style={{...styles.inputGroup, gridColumn: 'span 2'}}><label>URL de Imagen</label><input name="imagen" defaultValue={editing?.imagen} style={styles.inputField} /></div>
            </div>
            <div style={styles.modalActions}>
                <button type="submit" style={styles.btnModalSave}>Guardar Propiedad</button>
                <button type="button" onClick={() => {setShowModal(false); setEditing(null)}} style={styles.btnOutline}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// PALETA DE COLORES BASADA EN EL LOGO
const colors = {
  primary: '#00BFFF', // Azul cian vibrante del logo
  secondary: '#1A237E', // Azul oscuro profundo del logo
  background: '#F8FAFC', // Gris muy claro para el fondo
  textPrimary: '#0f172a', // Negro azulado para texto principal
  textSecondary: '#64748b', // Gris para texto secundario
  cardBg: '#FFFFFF', // Blanco para las tarjetas
  border: '#e2e8f0', // Gris claro para bordes
  white: '#FFFFFF',
  error: '#ef4444' // Rojo para errores
};

const styles = {
  // LOGIN STYLES
  loginContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: colors.background },
  loginCard: { background: colors.cardBg, padding: '50px', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', textAlign: 'center', width: '400px' },
  logoPlaceholder: { fontSize: '24px', fontWeight: '800', color: colors.primary, marginBottom: '20px', letterSpacing: '2px', borderBottom: `2px solid ${colors.secondary}`, display: 'inline-block', paddingBottom: '5px' },
  loginTitle: { fontSize: '26px', fontWeight: '800', color: colors.secondary, marginBottom: '5px' },
  loginSubtitle: { color: colors.textSecondary, marginBottom: '30px', fontSize: '15px' },
  inputFull: { width: '100%', padding: '14px', marginBottom: '15px', borderRadius: '12px', border: `1px solid ${colors.border}`, boxSizing: 'border-box', fontSize: '16px' },
  btnPrimaryFull: { width: '100%', padding: '16px', backgroundColor: colors.secondary, color: colors.white, border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', transition: 'background-color 0.2s' },
  errorMessage: { color: colors.error, fontSize: '14px', marginBottom: '15px', fontWeight: '600' },

  // MAIN LAYOUT STYLES
  container: { padding: '50px 20px', maxWidth: '1250px', margin: '0 auto', fontFamily: '"Inter", sans-serif', backgroundColor: colors.background },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '50px' },
  headerTitle: { fontSize: '32px', fontWeight: '800', color: colors.primary, margin: 0 },
  headerSubtitle: { color: colors.textSecondary, margin: 0, marginTop: '5px' },
  btnHeader: { padding: '14px 28px', backgroundColor: colors.secondary, color: colors.white, border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', fontSize: '15px' },
  btnOutline: { padding: '12px 24px', border: `1px solid ${colors.border}`, borderRadius: '12px', background: colors.white, cursor: 'pointer', color: colors.secondary, fontWeight: '600', fontSize: '15px' },
  searchInput: { width: '100%', padding: '20px', marginBottom: '50px', borderRadius: '16px', border: `1px solid ${colors.border}`, fontSize: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', boxSizing: 'border-box' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '30px' },

  // CARD STYLES (MATCHING REFERENCE FORMAT)
  card: { borderRadius: '20px', overflow: 'hidden', backgroundColor: colors.cardBg, boxShadow: '0 8px 12px -3px rgba(0,0,0,0.08)', border: `1px solid ${colors.border}`, transition: 'transform 0.2s, boxShadow 0.2s' },
  cardImage: { width: '100%', height: '230px', objectFit: 'cover' },
  cardContent: { padding: '20px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' },
  cardTitle: { fontSize: '20px', fontWeight: '700', margin: '0', color: colors.textPrimary },
  cardPrice: { fontSize: '20px', fontWeight: '800', color: colors.primary },
  cardLocation: { color: colors.textSecondary, fontSize: '14px', margin: '0', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '5px' },
  cardDivider: { height: '1px', backgroundColor: colors.border, margin: '15px 0' },
  detailsGrid: { display: 'flex', justifyContent: 'space-between', color: colors.secondary, fontSize: '14px', marginBottom: '15px', textAlign: 'center' },
  detailItem: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  cardPromo: { backgroundColor: `${colors.primary}15`, color: colors.secondary, padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', marginBottom: '15px' },
  btnCardEdit: { width: '100%', padding: '10px', backgroundColor: colors.white, color: colors.secondary, border: `1px solid ${colors.primary}`, borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'background-color 0.2s' },

  // MODAL STYLES
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(5px)' },
  modalForm: { background: colors.cardBg, padding: '40px', borderRadius: '24px', width: '90%', maxWidth: '650px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' },
  modalTitle: { marginBottom: '25px', fontWeight: '800', fontSize: '22px', color: colors.secondary },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  inputField: { padding: '12px', borderRadius: '8px', border: `1px solid ${colors.border}`, fontSize: '15px', width: '100%', boxSizing: 'border-box' },
  modalActions: { display: 'flex', gap: '15px', marginTop: '30px' },
  btnModalSave: { flex: 1, padding: '14px', backgroundColor: colors.secondary, color: colors.white, border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }
};