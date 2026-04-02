import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // <--- Paso 1: Importar el motor de contraseñas

// Tus credenciales de dk-tu-casa
const firebaseConfig = {
  apiKey: "AIzaSyD9T0RnifxVQIE3xUR7cA4sH4mE7nl93CA", 
  authDomain: "dk-tu-casa.firebaseapp.com",
  projectId: "dk-tu-casa",
  storageBucket: "dk-tu-casa.firebasestorage.app",
  messagingSenderId: "184220925020",
  appId: "1:184220925020:web:0ed0488d46ba90ea7dba99"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Paso 2: Exportar la base de datos (db)
export const db = getFirestore(app);

// Paso 3: Exportar la autenticación (auth)
// Esto es lo que permite que el login de App.jsx funcione
export const auth = getAuth(app);