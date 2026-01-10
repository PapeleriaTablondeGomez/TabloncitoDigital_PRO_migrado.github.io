/* ============================================================
   CONFIGURACIÓN DE FIREBASE
   ============================================================
   
   INSTRUCCIONES PARA CONFIGURAR:
   
   1. Ve a https://console.firebase.google.com/
   2. Crea un nuevo proyecto (o usa uno existente)
   3. Ve a "Configuración del proyecto" > "Tus aplicaciones"
   4. Haz clic en el icono de web (</>)
   5. Registra tu app y copia la configuración aquí abajo
   6. Ve a "Firestore Database" y crea una base de datos en modo de prueba
   7. Configura las reglas de seguridad (ver más abajo)
   
   REGLAS DE SEGURIDAD RECOMENDADAS (en Firebase Console > Firestore > Reglas):
   
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Permitir lectura/escritura solo si el usuario está autenticado
       // O si quieres acceso público (menos seguro pero más fácil):
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   
   NOTA: Para producción, usa autenticación y reglas más estrictas
*/

// ⚠️ REEMPLAZA ESTOS VALORES CON TUS PROPIAS CREDENCIALES DE FIREBASE
const firebaseConfig = {
    apiKey: "TU_API_KEY_AQUI",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

// Inicializar Firebase solo si está configurado
let firebaseInicializado = false;
let db = null; // Referencia a Firestore

// Verificar si Firebase está configurado
function verificarConfiguracionFirebase() {
    return firebaseConfig.apiKey && 
           firebaseConfig.apiKey !== "TU_API_KEY_AQUI" &&
           firebaseConfig.projectId && 
           firebaseConfig.projectId !== "TU_PROJECT_ID";
}

// Inicializar Firebase
async function inicializarFirebase() {
    if (firebaseInicializado) {
        return db;
    }
    
    if (!verificarConfiguracionFirebase()) {
        console.warn('⚠️ Firebase no está configurado. Usando IndexedDB como respaldo.');
        return null;
    }
    
    try {
        // Verificar si Firebase está cargado
        if (typeof firebase === 'undefined') {
            console.error('❌ Firebase SDK no está cargado. Asegúrate de incluir el script de Firebase.');
            return null;
        }
        
        // Inicializar Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        // Obtener referencia a Firestore
        db = firebase.firestore();
        firebaseInicializado = true;
        
        console.log('✅ Firebase inicializado correctamente');
        return db;
    } catch (error) {
        console.error('❌ Error al inicializar Firebase:', error);
        return null;
    }
}

// Función para verificar si Firebase está disponible
function usarFirebase() {
    return verificarConfiguracionFirebase() && firebaseInicializado && db !== null;
}

