# 🔥 Configuración de Firebase Firestore

Esta guía te ayudará a configurar Firebase Firestore para reemplazar IndexedDB/localStorage con una base de datos en la nube.

## 📋 Ventajas de usar Firebase

- ✅ **Sincronización en tiempo real** entre dispositivos
- ✅ **Respaldo automático** en la nube
- ✅ **Sin límites de almacenamiento** (plan gratuito generoso)
- ✅ **Acceso desde cualquier dispositivo**
- ✅ **Historial de cambios** automático

## 🚀 Pasos para Configurar

### 1. Crear Proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en "Agregar proyecto" o selecciona uno existente
3. Ingresa un nombre para tu proyecto (ej: "tabloncito-digital")
4. Sigue los pasos del asistente

### 2. Crear Base de Datos Firestore

1. En el panel de Firebase, ve a **"Firestore Database"**
2. Haz clic en **"Crear base de datos"**
3. Selecciona **"Iniciar en modo de prueba"** (puedes cambiar las reglas después)
4. Elige una ubicación (recomendado: `us-central` o la más cercana a ti)
5. Haz clic en **"Habilitar"**

### 3. Configurar Reglas de Seguridad

1. Ve a la pestaña **"Reglas"** en Firestore
2. Reemplaza las reglas con:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir lectura/escritura para todos (modo desarrollo)
    // ⚠️ Para producción, configura autenticación
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Haz clic en **"Publicar"**

### 4. Obtener Credenciales de la App Web

1. En Firebase Console, ve a **"Configuración del proyecto"** (icono de engranaje)
2. Desplázate hacia abajo y haz clic en **"Tus aplicaciones"**
3. Haz clic en el icono **`</>`** (web)
4. Registra tu app con un nombre (ej: "Tabloncito Digital Web")
5. **NO marques** "También configurar Firebase Hosting"
6. Copia la configuración que aparece (objeto `firebaseConfig`)

### 5. Configurar en tu Proyecto

1. Abre el archivo `firebase-config.js`
2. Reemplaza los valores en `firebaseConfig` con los que copiaste:

```javascript
const firebaseConfig = {
    apiKey: "AIza...", // Tu API Key
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto-id",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};
```

3. Guarda el archivo

### 6. Migrar Datos Existentes

1. Abre tu aplicación en el navegador
2. Ve a la consola del navegador (F12)
3. Ejecuta el siguiente comando:

```javascript
migrarIndexedDBAFirestore()
```

4. Confirma la migración cuando se te solicite
5. Espera a que se complete (verás mensajes en la consola)

## ✅ Verificación

Para verificar que todo funciona:

1. Abre la consola del navegador (F12)
2. Deberías ver: `✅ Firebase inicializado correctamente`
3. Agrega o modifica un producto
4. Ve a Firebase Console > Firestore Database
5. Deberías ver la colección `productos` con tus datos

## 🔄 Sincronización Automática

Los datos se sincronizan automáticamente cuando:
- Guardas un producto
- Registras una venta
- Agregas un crédito o tarea
- Modificas servicios

## 📱 Acceso desde Múltiples Dispositivos

Una vez configurado, tus datos estarán disponibles en:
- ✅ Mismo navegador en diferentes dispositivos
- ✅ Diferentes navegadores
- ✅ Diferentes computadoras

Solo necesitas abrir la misma URL y los datos se cargarán automáticamente desde Firebase.

## 🔒 Seguridad (Opcional - Para Producción)

Para mayor seguridad, puedes:

1. **Habilitar Autenticación en Firebase:**
   - Ve a "Authentication" en Firebase Console
   - Habilita "Email/Password" o "Anonymous"
   - Modifica las reglas de Firestore para requerir autenticación

2. **Reglas de Seguridad Avanzadas:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Solo usuarios autenticados pueden leer/escribir
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🆘 Solución de Problemas

### Firebase no se inicializa
- Verifica que las credenciales en `firebase-config.js` sean correctas
- Asegúrate de que los scripts de Firebase estén cargados antes de `script.js`

### Los datos no se guardan
- Verifica las reglas de Firestore (deben permitir escritura)
- Revisa la consola del navegador para ver errores
- Verifica que la base de datos esté creada en Firebase Console

### Los datos no se cargan
- Verifica tu conexión a internet
- Revisa las reglas de Firestore (deben permitir lectura)
- Verifica que los datos existan en Firebase Console

## 💡 Consejos

- **Respaldo Local:** Los datos también se guardan en IndexedDB como respaldo local
- **Modo Offline:** Firebase tiene soporte offline, pero funciona mejor con conexión
- **Límites Gratuitos:** El plan gratuito de Firebase es muy generoso (50,000 lecturas/día, 20,000 escrituras/día)
- **Migración:** Puedes migrar datos en cualquier momento usando `migrarIndexedDBAFirestore()`

## 📞 Soporte

Si tienes problemas:
1. Revisa la consola del navegador (F12) para ver errores
2. Verifica que Firebase esté correctamente configurado
3. Asegúrate de que las reglas de Firestore permitan lectura/escritura

