/* ============================================================
   FUNCIONES DE BASE DE DATOS FIREBASE FIRESTORE
   ============================================================
   
   Este archivo contiene funciones para guardar y cargar datos
   desde Firebase Firestore. Si Firebase no está configurado,
   automáticamente usa IndexedDB como respaldo.
*/

// Colecciones en Firestore (equivalente a "stores" en IndexedDB)
const FIRESTORE_COLLECTIONS = {
    productos: 'productos',
    carrito: 'carrito',
    ventas: 'ventas',
    creditos: 'creditos',
    tareas: 'tareas',
    servicios: 'servicios',
    clientes: 'clientes',
    presupuesto: 'presupuesto',
    config: 'config'
};

// Guardar datos en Firestore
async function guardarEnFirestore(collectionName, datos) {
    try {
        const firestoreDB = await inicializarFirebase();
        if (!firestoreDB) {
            // Si Firebase no está disponible, usar IndexedDB como respaldo
            console.log(`⚠️ Firebase no disponible, usando IndexedDB para ${collectionName}`);
            return await guardarEnIndexedDB(collectionName, datos);
        }
        
        const collectionRef = firestoreDB.collection(collectionName);
        
        // Si es un array, usar batch para guardar múltiples documentos
        if (Array.isArray(datos)) {
            if (datos.length === 0) {
                // Si el array está vacío, limpiar la colección
                const snapshot = await collectionRef.get();
                const batch = firestoreDB.batch();
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                console.log(`✅ Colección ${collectionName} limpiada en Firestore`);
                return true;
            }
            
            // Limpiar colección primero (opcional, puedes comentar esto si quieres mantener datos antiguos)
            const snapshot = await collectionRef.get();
            const batch = firestoreDB.batch();
            
            // Eliminar documentos existentes
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Agregar nuevos documentos
            datos.forEach((item, index) => {
                const docId = item.id || `item_${Date.now()}_${index}`;
                const docRef = collectionRef.doc(String(docId));
                // Remover campos que Firestore no puede manejar directamente
                const itemLimpio = { ...item };
                delete itemLimpio.updatedAt; // Se agregará automáticamente
                batch.set(docRef, {
                    ...itemLimpio,
                    id: docId,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            
            await batch.commit();
        } else {
            // Si es un objeto único, guardarlo como documento
            const batch = firestoreDB.batch();
            const docId = datos.id || 'main';
            const docRef = collectionRef.doc(String(docId));
            const datosLimpios = { ...datos };
            delete datosLimpios.updatedAt;
            batch.set(docRef, {
                ...datosLimpios,
                id: docId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await batch.commit();
        }
        console.log(`✅ ${Array.isArray(datos) ? datos.length : 1} documento(s) guardado(s) en Firestore: ${collectionName}`);
        return true;
    } catch (error) {
        console.error(`❌ Error al guardar en Firestore (${collectionName}):`, error);
        // Fallback a IndexedDB si Firestore falla
        try {
            return await guardarEnIndexedDB(collectionName, datos);
        } catch (e) {
            console.error('❌ Error también en IndexedDB:', e);
            throw e;
        }
    }
}

// Cargar datos de Firestore
async function cargarDeFirestore(collectionName) {
    try {
        const firestoreDB = await inicializarFirebase();
        if (!firestoreDB) {
            // Si Firebase no está disponible, usar IndexedDB como respaldo
            console.log(`⚠️ Firebase no disponible, usando IndexedDB para ${collectionName}`);
            return await cargarDeIndexedDB(collectionName);
        }
        
        const collectionRef = firestoreDB.collection(collectionName);
        const snapshot = await collectionRef.get();
        
        if (snapshot.empty) {
            console.log(`📭 Colección ${collectionName} está vacía en Firestore`);
            return [];
        }
        
        const datos = [];
        snapshot.forEach(doc => {
            datos.push(doc.data());
        });
        
        console.log(`✅ ${datos.length} documento(s) cargado(s) de Firestore: ${collectionName}`);
        return datos;
    } catch (error) {
        console.error(`❌ Error al cargar de Firestore (${collectionName}):`, error);
        // Fallback a IndexedDB si Firestore falla
        try {
            return await cargarDeIndexedDB(collectionName);
        } catch (e) {
            console.error('❌ Error también en IndexedDB:', e);
            return [];
        }
    }
}

// Eliminar un documento de Firestore
async function eliminarDeFirestore(collectionName, docId) {
    try {
        const firestoreDB = await inicializarFirebase();
        if (!firestoreDB) {
            return await eliminarItemIndexedDB(collectionName, docId);
        }
        
        const docRef = firestoreDB.collection(collectionName).doc(String(docId));
        await docRef.delete();
        console.log(`✅ Documento eliminado de Firestore: ${collectionName}/${docId}`);
        return true;
    } catch (error) {
        console.error(`❌ Error al eliminar de Firestore (${collectionName}/${docId}):`, error);
        return await eliminarItemIndexedDB(collectionName, docId);
    }
}

// Actualizar un documento específico en Firestore
async function actualizarEnFirestore(collectionName, docId, datos) {
    try {
        const firestoreDB = await inicializarFirebase();
        if (!firestoreDB) {
            // Para IndexedDB, necesitaríamos una función de actualización
            return false;
        }
        
        const docRef = firestoreDB.collection(collectionName).doc(String(docId));
        await docRef.update({
            ...datos,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Documento actualizado en Firestore: ${collectionName}/${docId}`);
        return true;
    } catch (error) {
        console.error(`❌ Error al actualizar en Firestore (${collectionName}/${docId}):`, error);
        return false;
    }
}

// Migrar datos de IndexedDB a Firestore
async function migrarIndexedDBAFirestore() {
    try {
        const firestoreDB = await inicializarFirebase();
        if (!firestoreDB) {
            alert('⚠️ Firebase no está configurado. No se puede migrar.');
            return false;
        }
        
        const confirmar = confirm(
            '¿Deseas migrar todos los datos de IndexedDB a Firebase Firestore?\n\n' +
            'Esto copiará todos tus productos, ventas, créditos, tareas y servicios a la nube.\n\n' +
            'Los datos locales se mantendrán como respaldo.'
        );
        
        if (!confirmar) {
            return false;
        }
        
        console.log('🔄 Iniciando migración de IndexedDB a Firestore...');
        
        // Migrar cada colección
        const colecciones = ['productos', 'ventas', 'creditos', 'tareas', 'servicios', 'clientes', 'presupuesto'];
        let migrados = 0;
        
        for (const coleccion of colecciones) {
            try {
                await initIndexedDB();
                const datos = await cargarDeIndexedDB(coleccion);
                if (datos && datos.length > 0) {
                    await guardarEnFirestore(coleccion, datos);
                    migrados += datos.length;
                    console.log(`✅ Migrados ${datos.length} ${coleccion}`);
                }
            } catch (e) {
                console.warn(`⚠️ Error al migrar ${coleccion}:`, e);
            }
        }
        
        alert(`✅ Migración completada!\n\nSe migraron ${migrados} documentos a Firebase Firestore.\n\nLos datos locales se mantienen como respaldo.`);
        return true;
    } catch (error) {
        console.error('❌ Error en la migración:', error);
        alert('❌ Error al migrar datos: ' + error.message);
        return false;
    }
}

// Función unificada para guardar (usa Firestore si está disponible, sino IndexedDB)
async function guardarDatos(collectionName, datos) {
    if (usarFirebase()) {
        return await guardarEnFirestore(collectionName, datos);
    } else {
        return await guardarEnIndexedDB(collectionName, datos);
    }
}

// Función unificada para cargar (usa Firestore si está disponible, sino IndexedDB)
async function cargarDatos(collectionName) {
    if (usarFirebase()) {
        return await cargarDeFirestore(collectionName);
    } else {
        return await cargarDeIndexedDB(collectionName);
    }
}

// Función para sincronizar datos locales con Firestore (útil para mantener ambos actualizados)
async function sincronizarConFirestore() {
    if (!usarFirebase()) {
        console.log('⚠️ Firebase no está configurado. No se puede sincronizar.');
        return false;
    }
    
    try {
        console.log('🔄 Sincronizando datos locales con Firestore...');
        
        // Cargar desde Firestore y actualizar localmente
        const colecciones = ['productos', 'ventas', 'creditos', 'tareas', 'servicios', 'clientes'];
        
        for (const coleccion of colecciones) {
            try {
                const datosFirestore = await cargarDeFirestore(coleccion);
                if (datosFirestore && datosFirestore.length > 0) {
                    // Guardar también en IndexedDB como respaldo local
                    await guardarEnIndexedDB(coleccion, datosFirestore);
                    console.log(`✅ Sincronizados ${datosFirestore.length} ${coleccion}`);
                }
            } catch (e) {
                console.warn(`⚠️ Error al sincronizar ${coleccion}:`, e);
            }
        }
        
        console.log('✅ Sincronización completada');
        return true;
    } catch (error) {
        console.error('❌ Error en la sincronización:', error);
        return false;
    }
}

