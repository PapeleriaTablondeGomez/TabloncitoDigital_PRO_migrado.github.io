/* ============================================================
   CONFIG LOGIN ADMINn
============================================================ */
const ADMIN_CONFIG = {
    usuario: 'admin',
    contraseña: 'fercho1749' // cámbiala si quieres
};

/* ============================================================
   STORAGE KEYS
============================================================ */
const STORAGE_KEYS = {
    productos: 'TD_PRODUCTOS_V3',
    carrito: 'TD_CARRITO_V3',
    ventas: 'TD_VENTAS_V1',
    creditos: 'TD_CREDITOS_V1',
    tareas: 'TD_TAREAS_V1',
    servicios: 'TD_SERVICIOS_V1',
    adminLogged: 'TD_ADMIN_LOGGED',
    githubConfig: 'TD_GITHUB_CONFIG',
    ventasFileHandle: 'TD_VENTAS_FILE_HANDLE',
    creditosFileHandle: 'TD_CREDITOS_FILE_HANDLE',
    tareasFileHandle: 'TD_TAREAS_FILE_HANDLE'
};

let productos = [];
let carrito = [];
let ventas = [];
let creditos = [];
let tareas = [];
let servicios = [];
let ventasRangoActual = 'hoy';
let creditosFiltroActual = 'todos';
let tareasFiltroActual = 'todas';
let adminLogueado = false;
let ventasFileHandle = null; // Handle para File System Access API
let creditosFileHandle = null; // Handle para File System Access API de créditos
let tareasFileHandle = null; // Handle para File System Access API de tareas
let intervaloCountdownTareas = null; // Intervalo para actualizar countdowns

/* ============================================================
   UTILIDADES - GESTIÓN DE ALMACENAMIENTO CON INDEXEDDB
============================================================ */

// IndexedDB - Sistema de almacenamiento robusto (puede almacenar GBs)
let db = null;
const DB_NAME = 'TabloncitoDigitalDB';
const DB_VERSION = 1;
const STORES = {
    productos: 'productos',
    carrito: 'carrito',
    ventas: 'ventas',
    creditos: 'creditos',
    tareas: 'tareas',
    servicios: 'servicios',
    config: 'config'
};

// Inicializar IndexedDB
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Error al abrir IndexedDB:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('✅ IndexedDB inicializado correctamente');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Crear object stores si no existen
            if (!db.objectStoreNames.contains(STORES.productos)) {
                db.createObjectStore(STORES.productos, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.carrito)) {
                db.createObjectStore(STORES.carrito, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.ventas)) {
                const ventasStore = db.createObjectStore(STORES.ventas, { keyPath: 'id' });
                ventasStore.createIndex('fecha', 'fecha', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORES.creditos)) {
                const creditosStore = db.createObjectStore(STORES.creditos, { keyPath: 'id' });
                creditosStore.createIndex('fecha', 'fecha', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORES.tareas)) {
                const tareasStore = db.createObjectStore(STORES.tareas, { keyPath: 'id' });
                tareasStore.createIndex('fechaEntrega', 'fechaEntrega', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORES.servicios)) {
                db.createObjectStore(STORES.servicios, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.config)) {
                db.createObjectStore(STORES.config, { keyPath: 'key' });
            }
        };
    });
}

// Guardar datos en IndexedDB
async function guardarEnIndexedDB(storeName, datos) {
    try {
        await initIndexedDB();
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        // Limpiar store antes de guardar
        await new Promise((resolve, reject) => {
            const clearReq = store.clear();
            clearReq.onsuccess = () => resolve();
            clearReq.onerror = () => reject(clearReq.error);
        });
        
        // Guardar todos los datos
        const promises = datos.map(item => {
            return new Promise((resolve, reject) => {
                const request = store.add(item);
                request.onsuccess = () => resolve();
                request.onerror = () => {
                    // Si ya existe, actualizar
                    const updateReq = store.put(item);
                    updateReq.onsuccess = () => resolve();
                    updateReq.onerror = () => reject(updateReq.error);
                };
            });
        });
        
        await Promise.all(promises);
        return true;
    } catch (error) {
        console.error(`Error al guardar en ${storeName}:`, error);
        throw error;
    }
}

// Cargar datos de IndexedDB
async function cargarDeIndexedDB(storeName) {
    try {
        await initIndexedDB();
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                resolve(request.result || []);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error(`Error al cargar de ${storeName}:`, error);
        return [];
    }
}

// Guardar un solo item en IndexedDB
async function guardarItemIndexedDB(storeName, item) {
    try {
        await initIndexedDB();
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.put(item);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error(`Error al guardar item en ${storeName}:`, error);
        throw error;
    }
}

// Eliminar item de IndexedDB
async function eliminarItemIndexedDB(storeName, id) {
    try {
        await initIndexedDB();
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error(`Error al eliminar item de ${storeName}:`, error);
        throw error;
    }
}

// Migrar datos de localStorage a IndexedDB
async function migrarDesdeLocalStorage() {
    try {
        // Verificar si ya se migró
        const migrado = localStorage.getItem('TD_MIGRADO_A_INDEXEDDB');
        if (migrado === 'true') {
            return; // Ya migrado
        }

        console.log('🔄 Migrando datos de localStorage a IndexedDB...');
        
        await initIndexedDB();
        
        // Migrar productos
        try {
            const productosLS = JSON.parse(localStorage.getItem(STORAGE_KEYS.productos) || '[]');
            if (Array.isArray(productosLS) && productosLS.length > 0) {
                await guardarEnIndexedDB(STORES.productos, productosLS);
                console.log(`✅ Migrados ${productosLS.length} productos`);
            }
        } catch (e) {
            console.warn('Error al migrar productos:', e);
        }
        
        // Migrar ventas
        try {
            const ventasLS = JSON.parse(localStorage.getItem(STORAGE_KEYS.ventas) || '[]');
            if (Array.isArray(ventasLS) && ventasLS.length > 0) {
                // Convertir array a objetos con id como key
                const ventasObjetos = ventasLS.map(v => ({ id: v.id || Date.now() + Math.random(), ...v }));
                await guardarEnIndexedDB(STORES.ventas, ventasObjetos);
                console.log(`✅ Migradas ${ventasLS.length} ventas`);
            }
        } catch (e) {
            console.warn('Error al migrar ventas:', e);
        }
        
        // Migrar carrito
        try {
            const carritoLS = JSON.parse(localStorage.getItem(STORAGE_KEYS.carrito) || '[]');
            if (Array.isArray(carritoLS) && carritoLS.length > 0) {
                const carritoObjetos = carritoLS.map((item, idx) => ({ 
                    id: item.id || `carrito_${idx}_${Date.now()}`, 
                    ...item 
                }));
                await guardarEnIndexedDB(STORES.carrito, carritoObjetos);
                console.log(`✅ Migrado carrito`);
            }
        } catch (e) {
            console.warn('Error al migrar carrito:', e);
        }
        
        // Marcar como migrado
        localStorage.setItem('TD_MIGRADO_A_INDEXEDDB', 'true');
        console.log('✅ Migración completada');
        
    } catch (error) {
        console.error('Error en migración:', error);
    }
}

// Función para comprimir JSON (eliminar espacios innecesarios)
function comprimirJSON(obj) {
    if (!STORAGE_CONFIG.comprimirJSON) {
        return JSON.stringify(obj);
    }
    return JSON.stringify(obj);
}

// Función para simplificar un item de venta (eliminar datos redundantes)
function simplificarItemVenta(item) {
    return {
        i: item.idProducto,           // idProducto -> i
        n: item.nombre?.substring(0, 30) || '', // nombre truncado -> n
        t: item.tipo,                 // tipo -> t
        c: item.cantidad,              // cantidad -> c
        p: item.precioUnitario,       // precioUnitario -> p
        v: item.variante || '',       // variante -> v
        vn: item.varianteNombre?.substring(0, 20) || '' // varianteNombre truncado -> vn
    };
}

// Función para descomprimir un item de venta
function descomprimirItemVenta(itemComprimido) {
    if (!itemComprimido.i) return itemComprimido; // Ya está descomprimido
    return {
        idProducto: itemComprimido.i,
        nombre: itemComprimido.n,
        tipo: itemComprimido.t,
        cantidad: itemComprimido.c,
        precioUnitario: itemComprimido.p,
        subtotal: itemComprimido.p * itemComprimido.c,
        variante: itemComprimido.v || '',
        varianteNombre: itemComprimido.vn || ''
    };
}

// Función para crear resumen de venta (solo datos esenciales)
function crearResumenVenta(venta) {
    return {
        id: venta.id,
        f: venta.fecha,              // fecha -> f
        t: venta.tipo,                // tipo -> t
        tot: venta.total,             // total -> tot
        n: venta.items?.length || 0   // número de items -> n
    };
}

// Función para descomprimir resumen de venta
function descomprimirResumenVenta(resumen) {
    return {
        id: resumen.id,
        fecha: resumen.f,
        tipo: resumen.t,
        total: resumen.tot,
        items: [], // Items no disponibles en resumen
        esResumen: true
    };
}

// Función para comprimir venta completa (simplificar items)
function comprimirVenta(venta) {
    const ventaComprimida = {
        id: venta.id,
        f: venta.fecha,
        t: venta.tipo,
        tot: venta.total
    };
    
    if (venta.items && Array.isArray(venta.items)) {
        ventaComprimida.i = venta.items.map(simplificarItemVenta);
    }
    
    return ventaComprimida;
}

// Función para descomprimir venta
function descomprimirVenta(ventaComprimida) {
    if (ventaComprimida.esResumen) {
        return descomprimirResumenVenta(ventaComprimida);
    }
    
    const venta = {
        id: ventaComprimida.id,
        fecha: ventaComprimida.f || ventaComprimida.fecha,
        tipo: ventaComprimida.t || ventaComprimida.tipo,
        total: ventaComprimida.tot || ventaComprimida.total
    };
    
    if (ventaComprimida.i) {
        venta.items = ventaComprimida.i.map(descomprimirItemVenta);
    } else if (ventaComprimida.items) {
        // Ya está descomprimido o es formato antiguo
        venta.items = ventaComprimida.items.map(item => {
            if (item.i) return descomprimirItemVenta(item);
            return item;
        });
    }
    
    return venta;
}

// Función para verificar y limpiar espacio proactivamente
function mantenerLimpiezaAutomatica() {
    if (!STORAGE_CONFIG.limpiezaAutomatica) return;
    
    try {
        // Cargar y procesar ventas
        const ventasGuardadas = JSON.parse(localStorage.getItem(STORAGE_KEYS.ventas) || '[]');
        if (!Array.isArray(ventasGuardadas)) return;
        
        const ahora = new Date();
        const fechaLimiteCompletas = new Date(ahora.getTime() - (STORAGE_CONFIG.diasRetencionCompletas * 24 * 60 * 60 * 1000));
        const fechaLimiteResumen = new Date(ahora.getTime() - (STORAGE_CONFIG.diasRetencionResumen * 24 * 60 * 60 * 1000));
        
        // Ordenar por fecha (más recientes primero)
        const ventasOrdenadas = ventasGuardadas
            .map(v => descomprimirVenta(v)) // Descomprimir para procesar
            .sort((a, b) => {
                const fechaA = a.fecha ? new Date(a.fecha).getTime() : 0;
                const fechaB = b.fecha ? new Date(b.fecha).getTime() : 0;
                return fechaB - fechaA;
            });
        
        const ventasProcesadas = [];
        let ventasCompletas = 0;
        let ventasResumen = 0;
        
        ventasOrdenadas.forEach(venta => {
            if (!venta.fecha) return; // Eliminar ventas sin fecha
            
            const fechaVenta = new Date(venta.fecha);
            
            if (fechaVenta >= fechaLimiteCompletas && ventasCompletas < STORAGE_CONFIG.maxVentasCompletas) {
                // Ventas recientes: mantener completas pero comprimidas
                ventasProcesadas.push(comprimirVenta(venta));
                ventasCompletas++;
            } else if (fechaVenta >= fechaLimiteResumen && ventasResumen < STORAGE_CONFIG.maxVentasResumen) {
                // Ventas intermedias: solo resumen
                ventasProcesadas.push(crearResumenVenta(venta));
                ventasResumen++;
            }
            // Ventas muy antiguas: se eliminan
        });
        
        if (ventasProcesadas.length < ventasGuardadas.length) {
            const eliminadas = ventasGuardadas.length - ventasProcesadas.length;
            localStorage.setItem(STORAGE_KEYS.ventas, comprimirJSON(ventasProcesadas));
            ventas = ventasProcesadas.map(v => descomprimirVenta(v));
            console.log(`🧹 Limpieza automática: ${eliminadas} ventas eliminadas. ${ventasCompletas} completas, ${ventasResumen} resúmenes.`);
        }
        
        // Limpiar carrito si tiene más de 7 días sin uso
        try {
            const carritoGuardado = localStorage.getItem(STORAGE_KEYS.carrito);
            if (carritoGuardado) {
                const ultimaActualizacion = localStorage.getItem('TD_CARRITO_ULTIMA_ACTUALIZACION');
                if (ultimaActualizacion) {
                    const fechaActualizacion = new Date(parseInt(ultimaActualizacion));
                    const hace7Dias = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
                    if (fechaActualizacion < hace7Dias) {
                        localStorage.removeItem(STORAGE_KEYS.carrito);
                        localStorage.removeItem('TD_CARRITO_ULTIMA_ACTUALIZACION');
                        console.log('🧹 Carrito antiguo eliminado (más de 7 días sin uso)');
                    }
                }
            }
        } catch (e) {}
        
    } catch (e) {
        console.warn('Error en limpieza automática:', e);
    }
}

// Función para obtener la configuración de GitHub
function obtenerConfigGitHub() {
    try {
        const configStr = localStorage.getItem(STORAGE_KEYS.githubConfig);
        if (configStr) {
            return JSON.parse(configStr);
        }
    } catch (e) {
        console.error('Error al leer configuración de GitHub:', e);
    }
    return null;
}

// Función para guardar la configuración de GitHub
function guardarConfigGitHub(config) {
    try {
        localStorage.setItem(STORAGE_KEYS.githubConfig, JSON.stringify(config));
        return true;
    } catch (e) {
        console.error('Error al guardar configuración de GitHub:', e);
        return false;
    }
}

// Función para cargar y mostrar la configuración de GitHub en el formulario
function cargarConfigGitHubEnFormulario() {
    const config = obtenerConfigGitHub();
    if (config) {
        const tokenInput = document.getElementById('githubToken');
        const ownerInput = document.getElementById('githubOwner');
        const repoInput = document.getElementById('githubRepo');
        const branchInput = document.getElementById('githubBranch');
        
        if (tokenInput) tokenInput.value = config.token || '';
        if (ownerInput) ownerInput.value = config.owner || '';
        if (repoInput) repoInput.value = config.repo || '';
        if (branchInput) branchInput.value = config.branch || 'main';
    }
}

// Función para guardar la configuración desde el formulario
function guardarConfigGitHubDesdeFormulario() {
    const tokenInput = document.getElementById('githubToken');
    const ownerInput = document.getElementById('githubOwner');
    const repoInput = document.getElementById('githubRepo');
    const branchInput = document.getElementById('githubBranch');
    const statusDiv = document.getElementById('githubConfigStatus');
    
    if (!tokenInput || !ownerInput || !repoInput) {
        return false;
    }
    
    const token = tokenInput.value.trim();
    const owner = ownerInput.value.trim();
    const repo = repoInput.value.trim();
    const branch = (branchInput?.value.trim() || 'main');
    
    if (!token || !owner || !repo) {
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#ffebee';
            statusDiv.style.color = '#c62828';
            statusDiv.textContent = '❌ Por favor completa todos los campos requeridos.';
        }
        return false;
    }
    
    const config = {
        token: token,
        owner: owner,
        repo: repo,
        branch: branch
    };
    
    if (guardarConfigGitHub(config)) {
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#e8f5e9';
            statusDiv.style.color = '#2e7d32';
            statusDiv.textContent = '✅ Configuración guardada correctamente.';
        }
        return true;
    } else {
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#ffebee';
            statusDiv.style.color = '#c62828';
            statusDiv.textContent = '❌ Error al guardar la configuración.';
        }
        return false;
    }
}

// Función para probar la conexión con GitHub
async function probarConexionGitHub() {
    const config = obtenerConfigGitHub();
    const statusDiv = document.getElementById('githubConfigStatus');
    
    if (!config || !config.token || !config.owner || !config.repo) {
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#fff3e0';
            statusDiv.style.color = '#e65100';
            statusDiv.textContent = '⚠️ Primero guarda la configuración.';
        }
        return false;
    }
    
    if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#e3f2fd';
        statusDiv.style.color = '#1565c0';
        statusDiv.textContent = '🔄 Probando conexión...';
    }
    
    try {
        const response = await fetch(
            `https://api.github.com/repos/${config.owner}/${config.repo}`,
            {
                headers: {
                    'Authorization': `token ${config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        if (response.ok) {
            if (statusDiv) {
                statusDiv.style.display = 'block';
                statusDiv.style.background = '#e8f5e9';
                statusDiv.style.color = '#2e7d32';
                statusDiv.textContent = '✅ Conexión exitosa. El archivo se actualizará automáticamente.';
            }
            return true;
        } else {
            const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
            throw new Error(errorData.message || `Error ${response.status}`);
        }
    } catch (error) {
        if (statusDiv) {
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#ffebee';
            statusDiv.style.color = '#c62828';
            statusDiv.textContent = `❌ Error de conexión: ${error.message}`;
        }
        console.error('Error al probar conexión con GitHub:', error);
        return false;
    }
}

// Variable global para guardar el handle del archivo (File System Access API)
let archivoHandle = null;
const STORAGE_KEYS_ARCHIVO = 'TD_ARCHIVO_HANDLE';

// Función para solicitar acceso al archivo local (solo una vez)
async function solicitarAccesoArchivoLocal() {
    try {
        // Verificar si el navegador soporta File System Access API
        if (!('showOpenFilePicker' in window)) {
            console.warn('⚠️ File System Access API no está disponible en este navegador.');
            alert('Tu navegador no soporta la actualización directa de archivos. Usa Chrome, Edge u otro navegador moderno.');
            return false;
        }
        
        // Si ya tenemos el handle, no necesitamos pedirlo de nuevo
        if (archivoHandle) {
            return true;
        }
        
        // Intentar abrir el archivo existente
        try {
            const [handle] = await window.showOpenFilePicker({
                suggestedName: 'productos-iniciales.json',
                types: [{
                    description: 'JSON files',
                    accept: { 'application/json': ['.json'] }
                }],
                startIn: 'documents',
                multiple: false
            });
            
            // Verificar que el nombre del archivo sea correcto
            if (handle.name !== 'productos-iniciales.json') {
                const confirmar = confirm(`¿Estás seguro de que quieres usar el archivo "${handle.name}"?\n\nSe recomienda usar "productos-iniciales.json"`);
                if (!confirmar) {
                    return false;
                }
            }
            
            archivoHandle = handle;
            console.log('✅ Acceso al archivo local obtenido:', handle.name);
            
            // Actualizar el estado en la UI
            actualizarEstadoArchivo(true, handle.name);
            
            return true;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Usuario canceló la selección del archivo');
                return false;
            }
            throw error;
        }
    } catch (error) {
        console.error('Error al solicitar acceso al archivo:', error);
        alert('Error al seleccionar el archivo: ' + error.message);
        return false;
    }
}

// Función para actualizar el estado del archivo en la UI
function actualizarEstadoArchivo(conectado, nombreArchivo = '') {
    const statusDiv = document.getElementById('archivoStatus');
    if (!statusDiv) return;
    
    if (conectado && nombreArchivo) {
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#e8f5e9';
        statusDiv.style.color = '#2e7d32';
        statusDiv.textContent = `✅ Archivo conectado: ${nombreArchivo}`;
    } else {
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#fff3e0';
        statusDiv.style.color = '#e65100';
        statusDiv.textContent = '⚠️ No hay archivo seleccionado. Haz clic en "Seleccionar Archivo" para conectarlo.';
    }
}

// Función para actualizar el archivo local directamente
async function actualizarArchivoLocal() {
    try {
        // Ordenar productos por ID para mantener consistencia
        const productosOrdenados = [...productos].sort((a, b) => {
            const idA = Number(a.id) || 0;
            const idB = Number(b.id) || 0;
            return idA - idB;
        });
        
        // Convertir a JSON
        const jsonString = JSON.stringify(productosOrdenados, null, 2);
        
        // Si no tenemos el handle, intentar obtenerlo
        if (!archivoHandle) {
            const acceso = await solicitarAccesoArchivoLocal();
            if (!acceso) {
                console.warn('⚠️ No se pudo obtener acceso al archivo local. Usando método alternativo.');
                return await actualizarArchivoGitHub();
            }
        }
        
        // Escribir al archivo usando el handle
        const writable = await archivoHandle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        
        console.log('✅ Archivo local actualizado correctamente');
        return true;
    } catch (error) {
        console.error('❌ Error al actualizar archivo local:', error);
        // Si falla, intentar con GitHub API como respaldo
        return await actualizarArchivoGitHub();
    }
}

// Función para actualizar el archivo productos-iniciales.json en GitHub (método alternativo)
async function actualizarArchivoGitHub() {
    const config = obtenerConfigGitHub();
    
    if (!config || !config.token || !config.owner || !config.repo) {
        console.warn('⚠️ Configuración de GitHub no encontrada. El archivo no se actualizará.');
        return false;
    }
    
    try {
        // Ordenar productos por ID para mantener consistencia
        const productosOrdenados = [...productos].sort((a, b) => {
            const idA = Number(a.id) || 0;
            const idB = Number(b.id) || 0;
            return idA - idB;
        });
        
        // Convertir a JSON
        const jsonString = JSON.stringify(productosOrdenados, null, 2);
        
        // Codificar a base64 (manejo correcto de UTF-8)
        const contenidoBase64 = btoa(unescape(encodeURIComponent(jsonString)));
        
        // Obtener el SHA del archivo actual (necesario para actualizar)
        let shaActual = null;
        try {
            const responseGet = await fetch(
                `https://api.github.com/repos/${config.owner}/${config.repo}/contents/productos-iniciales.json`,
                {
                    headers: {
                        'Authorization': `token ${config.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (responseGet.ok) {
                const data = await responseGet.json();
                shaActual = data.sha;
            } else if (responseGet.status === 404) {
                // El archivo no existe, se creará uno nuevo
                console.log('📝 Archivo no existe en GitHub, se creará uno nuevo');
            } else {
                throw new Error(`Error al obtener archivo: ${responseGet.status} ${responseGet.statusText}`);
            }
        } catch (error) {
            console.error('Error al obtener SHA del archivo:', error);
            // Continuar intentando crear el archivo si no existe
        }
        
        // Preparar el cuerpo de la petición
        const body = {
            message: `Actualizar productos-iniciales.json - ${new Date().toLocaleString('es-CO')}`,
            content: contenidoBase64,
            branch: config.branch || 'main'
        };
        
        // Si el archivo existe, agregar el SHA
        if (shaActual) {
            body.sha = shaActual;
        }
        
        // Actualizar el archivo en GitHub
        const response = await fetch(
            `https://api.github.com/repos/${config.owner}/${config.repo}/contents/productos-iniciales.json`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${config.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Archivo actualizado en GitHub:', data.commit.html_url);
            return true;
        } else {
            const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
            throw new Error(`Error al actualizar archivo: ${response.status} - ${errorData.message || response.statusText}`);
        }
    } catch (error) {
        console.error('❌ Error al actualizar archivo en GitHub:', error);
        return false;
    }
}

async function guardarProductos(actualizarGitHub = false) {
    try {
        // Guardar en IndexedDB (sistema principal)
        await guardarEnIndexedDB(STORES.productos, productos);
        console.log('✅ Productos guardados en IndexedDB');
        
        // Actualizar archivo si se solicita (intenta local primero, luego GitHub)
        if (actualizarGitHub) {
            const actualizado = await actualizarArchivoLocal();
            if (actualizado) {
                console.log('✅ Archivo actualizado correctamente');
                // Invalidar cache para forzar recarga en próxima carga
                invalidarCacheProductos();
            } else {
                console.warn('⚠️ No se pudo actualizar el archivo.');
            }
        }
    } catch (error) {
        console.error('Error al guardar productos en IndexedDB:', error);
        // Fallback a localStorage si IndexedDB falla
        try {
            localStorage.setItem(STORAGE_KEYS.productos, JSON.stringify(productos));
            console.log('⚠️ Productos guardados en localStorage (fallback)');
            
            // Intentar actualizar archivo incluso en fallback
            if (actualizarGitHub) {
                await actualizarArchivoLocal();
            }
        } catch (e) {
            console.error('Error crítico al guardar productos:', e);
            alert('Error al guardar productos. Por favor, exporta tus datos como respaldo.');
        }
    }
}
function liberarEspacioLocalStorage(agresivo = false) {
    try {
        let espacioLiberado = false;
        
        // 1. Limpiar carrito (es temporal)
        try {
            localStorage.removeItem(STORAGE_KEYS.carrito);
            localStorage.removeItem('TD_CARRITO_ULTIMA_ACTUALIZACION');
            console.log('Carrito limpiado para liberar espacio');
            espacioLiberado = true;
        } catch (e) {}
        
        // 2. Limpiar ventas antiguas de forma más agresiva
        try {
            const ventasGuardadas = JSON.parse(localStorage.getItem(STORAGE_KEYS.ventas) || '[]');
            if (Array.isArray(ventasGuardadas) && ventasGuardadas.length > 0) {
                const ahora = new Date();
                // Si es agresivo, mantener solo 30 días, sino 60 días
                const diasRetencion = agresivo ? 30 : STORAGE_CONFIG.diasRetencionVentas;
                const fechaLimite = new Date(ahora.getTime() - (diasRetencion * 24 * 60 * 60 * 1000));
                const maxVentas = agresivo ? 200 : STORAGE_CONFIG.maxVentas;
                
                // Ordenar por fecha (más recientes primero)
                const ventasOrdenadas = ventasGuardadas.sort((a, b) => {
                    const fechaA = a.fecha ? new Date(a.fecha).getTime() : 0;
                    const fechaB = b.fecha ? new Date(b.fecha).getTime() : 0;
                    return fechaB - fechaA;
                });
                
                // Filtrar y limitar
                const ventasFiltradas = ventasOrdenadas
                    .filter(v => {
                        if (!v.fecha) return false; // Eliminar ventas sin fecha
                        const fechaVenta = new Date(v.fecha);
                        return fechaVenta >= fechaLimite;
                    })
                    .slice(0, maxVentas);
                
                if (ventasFiltradas.length < ventasGuardadas.length) {
                    const eliminadas = ventasGuardadas.length - ventasFiltradas.length;
                    localStorage.setItem(STORAGE_KEYS.ventas, comprimirJSON(ventasFiltradas));
                    ventas = ventasFiltradas;
                    console.log(`Se eliminaron ${eliminadas} ventas antiguas. Manteniendo ${ventasFiltradas.length} ventas.`);
                    espacioLiberado = true;
                }
            }
        } catch (e) {
            console.warn('Error al limpiar ventas antiguas:', e);
        }
        
        // 3. Limpiar claves antiguas que puedan existir
        try {
            const clavesAntiguas = ['TD_PRODUCTOS_V1', 'TD_PRODUCTOS_V2', 'TD_CARRITO_V1', 'TD_CARRITO_V2', 'TD_VENTAS_V0'];
            clavesAntiguas.forEach(clave => {
                try {
                    if (localStorage.getItem(clave)) {
                        localStorage.removeItem(clave);
                        espacioLiberado = true;
                    }
                } catch (e) {}
            });
        } catch (e) {}
        
        return espacioLiberado;
    } catch (e) {
        console.error('Error en liberarEspacioLocalStorage:', e);
        return false;
    }
}

async function guardarCarrito() {
    try {
        // Convertir carrito a objetos con id
        const carritoObjetos = carrito.map((item, idx) => ({
            id: item.id || `carrito_${idx}_${Date.now()}`,
            ...item
        }));
        await guardarEnIndexedDB(STORES.carrito, carritoObjetos);
        console.log('✅ Carrito guardado en IndexedDB');
    } catch (error) {
        console.error('Error al guardar carrito en IndexedDB:', error);
        // Fallback a localStorage
        try {
            localStorage.setItem(STORAGE_KEYS.carrito, JSON.stringify(carrito));
        } catch (e) {
            console.warn('No se pudo guardar el carrito');
        }
    }
}

async function guardarVentas() {
    try {
        // Asegurar que todas las ventas tengan ID válido
        const ventasConId = ventas.map(venta => {
            if (!venta.id || venta.id === null || venta.id === undefined) {
                return {
                    ...venta,
                    id: Date.now() + Math.random()
                };
            }
            return venta;
        });
        
        // Convertir ventas a objetos con id como key para IndexedDB
        const ventasObjetos = ventasConId.map(venta => ({
            id: venta.id,
            ...venta
        }));
        
        // Guardar en IndexedDB
        await guardarEnIndexedDB(STORES.ventas, ventasObjetos);
        console.log(`✅ ${ventasObjetos.length} ventas guardadas en IndexedDB`);
        
        // También guardar en localStorage como respaldo (siempre, no solo como fallback)
        try {
            localStorage.setItem(STORAGE_KEYS.ventas, JSON.stringify(ventasConId));
            console.log('✅ Ventas guardadas también en localStorage');
        } catch (e) {
            console.warn('No se pudo guardar en localStorage:', e);
        }
        
    } catch (error) {
        console.error('Error al guardar ventas en IndexedDB:', error);
        // Fallback a localStorage si IndexedDB falla
        try {
            localStorage.setItem(STORAGE_KEYS.ventas, JSON.stringify(ventas));
            console.log('⚠️ Ventas guardadas en localStorage (fallback)');
        } catch (e) {
            console.error('Error crítico al guardar ventas:', e);
        }
    }
    
    // Guardar automáticamente en archivo para respaldo
    await guardarVentasEnArchivo();
}

// Guardar ventas automáticamente en archivo (respaldo seguro)
async function guardarVentasEnArchivo() {
    try {
        if (!ventas || ventas.length === 0) {
            console.log('No hay ventas para guardar en archivo');
            return;
        }
        
        const json = JSON.stringify(ventas, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        
        // Intentar usar File System Access API si está disponible y hay un handle guardado
        if ('showSaveFilePicker' in window && ventasFileHandle) {
            try {
                // Escribir en el archivo existente
                const writable = await ventasFileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log('✅ Ventas guardadas automáticamente en archivo seleccionado');
                return;
            } catch (e) {
                // Si falla (por ejemplo, el usuario cerró el archivo), intentar descargar
                console.warn('No se pudo escribir en archivo guardado, descargando respaldo:', e);
                ventasFileHandle = null; // Limpiar handle inválido
                localStorage.removeItem(STORAGE_KEYS.ventasFileHandle);
            }
        }
        
        // Descargar automáticamente el archivo de respaldo
        // Usar nombre con fecha para que se actualice el archivo del día
        const fecha = new Date();
        const nombreArchivo = `ventas_respaldo_${fecha.getFullYear()}-${(fecha.getMonth()+1).toString().padStart(2,'0')}-${fecha.getDate().toString().padStart(2,'0')}.json`;
        
        // Descargar automáticamente (se sobrescribirá si ya existe en la carpeta de descargas)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        // Esperar un poco antes de remover para asegurar que la descarga inicie
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        console.log(`✅ Respaldo de ${ventas.length} ventas descargado automáticamente: ${nombreArchivo}`);
    } catch (error) {
        console.error('Error al guardar ventas en archivo:', error);
        // No mostrar error al usuario, solo loggear
    }
}

// Función para seleccionar archivo y guardar ventas automáticamente ahí
async function configurarGuardadoAutomaticoVentas() {
    if (!('showSaveFilePicker' in window)) {
        alert('Tu navegador no soporta guardado automático en archivo seleccionado.\n\nLas ventas se descargarán automáticamente en tu carpeta de descargas cada vez que se registre una venta.\n\nEsto funciona perfectamente: el archivo se guardará con el nombre "ventas_respaldo_YYYY-MM-DD.json" y se actualizará automáticamente.');
        return;
    }
    
    try {
        const json = JSON.stringify(ventas, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        
        const handle = await window.showSaveFilePicker({
            suggestedName: 'ventas_respaldo.json',
            types: [{
                description: 'Archivo JSON',
                accept: { 'application/json': ['.json'] }
            }]
        });
        
        // Guardar el handle en variable global (no se puede serializar en localStorage)
        ventasFileHandle = handle;
        
        // Escribir el archivo inicial
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        // Guardar indicador de que está configurado
        localStorage.setItem(STORAGE_KEYS.ventasFileHandle, 'configurado');
        
        // Actualizar el botón para mostrar que está activo
        const btn = document.getElementById('btnConfigurarGuardadoVentas');
        if (btn) {
            btn.textContent = '✅ Guardado automático activo';
            btn.classList.add('btn-success');
            btn.classList.remove('btn-primary');
        }
        
        alert('✅ Guardado automático configurado.\n\nLas ventas se guardarán automáticamente en este archivo cada vez que se registre una venta.\n\nNota: Si cierras el navegador, necesitarás seleccionar el archivo nuevamente la próxima vez.');
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error al configurar guardado automático:', error);
            alert('Error al configurar el guardado automático: ' + error.message);
        }
    }
}
function formatoPrecio(valor) {
    const n = Number(valor) || 0;
    return '$' + n.toLocaleString('es-CO');
}

// Función de depuración: forzar recarga de productos iniciales (ejecutar desde consola)
window.recargarProductosIniciales = async function() {
    console.log('🔄 Forzando recarga de productos iniciales...');
    const productosIniciales = await cargarProductosIniciales();
    console.log(`📦 Productos iniciales cargados: ${productosIniciales.length}`);
    
    if (productosIniciales.length > 0) {
        // Combinar con productos existentes
        const productosMap = new Map();
        productos.forEach(p => {
            const key = (p.sku && p.sku !== '0' && p.sku !== '') ? p.sku : p.nombre;
            if (key) productosMap.set(key, p);
        });
        productosIniciales.forEach(p => {
            const key = (p.sku && p.sku !== '0' && p.sku !== '') ? p.sku : p.nombre;
            if (key) productosMap.set(key, p);
        });
        
        productos = Array.from(productosMap.values());
        await guardarEnIndexedDB(STORES.productos, productos);
        
        // Recargar la vista
        if (document.body.dataset.page === 'tienda') {
            renderFiltrosCategoria();
            renderListaProductosTienda();
        } else if (document.body.dataset.page === 'admin') {
            renderInventarioTabla();
        }
        
        console.log(`✅ Total productos después de recargar: ${productos.length}`);
        alert(`Productos recargados. Total: ${productos.length}`);
    } else {
        console.error('No se pudieron cargar productos iniciales');
        alert('Error: No se pudieron cargar productos iniciales. Revisa la consola.');
    }
};

// Variable para cache inteligente del JSON
let cacheProductosJSON = {
    datos: null,
    timestamp: 0,
    etag: null
};

// Cargar productos iniciales desde JSON (para GitHub Pages) - VERSIÓN ULTRA RÁPIDA CON INLINE JSON
async function cargarProductosIniciales(usarCacheLocal = false) {
    try {
        // Si se solicita usar cache local y existe, devolverlo inmediatamente
        if (usarCacheLocal && cacheProductosJSON.datos) {
            console.log('⚡ Usando productos desde cache local');
            return cacheProductosJSON.datos;
        }
        
        // MÉTODO DRÁSTICO 1: Intentar cargar desde script tag inline (INSTANTÁNEO, sin petición HTTP)
        const scriptTag = document.getElementById('productos-iniciales-data');
        if (scriptTag && scriptTag.textContent.trim()) {
            try {
                const productosIniciales = JSON.parse(scriptTag.textContent);
                if (Array.isArray(productosIniciales) && productosIniciales.length > 0) {
                    cacheProductosJSON.datos = productosIniciales;
                    cacheProductosJSON.timestamp = Date.now();
                    console.log(`⚡⚡ ${productosIniciales.length} productos cargados desde JSON inline (INSTANTÁNEO)`);
                    return productosIniciales;
                }
            } catch (e) {
                console.warn('Error al parsear JSON inline:', e);
            }
        }
        
        // MÉTODO DRÁSTICO 2: Intentar cargar desde localStorage primero (más rápido que fetch)
        try {
            const cached = localStorage.getItem('TD_PRODUCTOS_JSON_CACHE');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
                    // Verificar si el cache es reciente (menos de 1 hora)
                    const cacheAge = Date.now() - (parsed.timestamp || 0);
                    if (cacheAge < 3600000) { // 1 hora
                        cacheProductosJSON.datos = parsed.data;
                        cacheProductosJSON.timestamp = parsed.timestamp;
                        console.log(`⚡ ${parsed.data.length} productos cargados desde cache localStorage (rápido)`);
                        return parsed.data;
                    }
                }
            }
        } catch (e) {
            console.warn('Error al cargar desde cache localStorage:', e);
        }
        
        // MÉTODO 3: Fetch desde archivo (solo si no hay datos inline ni cache)
        const rutas = [
            'productos-iniciales.json',
            './productos-iniciales.json',
            window.location.pathname.replace(/\/[^/]*$/, '/productos-iniciales.json')
        ];
        
        const ahora = Date.now();
        const primeraRuta = rutas[0];
        
        // Intentar solo la primera ruta con timeout muy corto (1 segundo)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000); // Timeout muy corto
            
            const response = await fetch(`${primeraRuta}?v=${ahora}`, {
                cache: 'default',
                headers: {
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const productosIniciales = await response.json();
                if (Array.isArray(productosIniciales) && productosIniciales.length > 0) {
                    cacheProductosJSON.datos = productosIniciales;
                    cacheProductosJSON.timestamp = ahora;
                    cacheProductosJSON.etag = response.headers.get('ETag');
                    
                    // Guardar en cache localStorage para próxima vez
                    try {
                        localStorage.setItem('TD_PRODUCTOS_JSON_CACHE', JSON.stringify({
                            data: productosIniciales,
                            timestamp: ahora
                        }));
                    } catch (e) {
                        console.warn('No se pudo guardar en cache localStorage:', e);
                    }
                    
                    console.log(`📦 ${productosIniciales.length} productos cargados desde ${primeraRuta}`);
                    return productosIniciales;
                }
            }
        } catch (e) {
            console.warn('Error al cargar desde fetch:', e);
        }
        
        // Si falla todo, intentar usar cache anterior como fallback
        if (cacheProductosJSON.datos) {
            console.warn('⚠️ No se pudo cargar JSON desde servidor, usando cache local');
            return cacheProductosJSON.datos;
        }
        
        console.warn('No se pudo cargar productos-iniciales.json desde ninguna fuente');
        return [];
    } catch (error) {
        console.warn('Error al cargar productos iniciales:', error);
        return cacheProductosJSON.datos || [];
    }
}

// Cargar servicios iniciales desde JSON (para GitHub Pages) - VERSIÓN DIRECTA Y CONFIABLE
let cacheServiciosJSON = {
    datos: null,
    timestamp: 0,
    etag: null
};

async function cargarServiciosIniciales(usarCacheLocal = false) {
    try {
        // Si se solicita usar cache local y existe, devolverlo inmediatamente
        if (usarCacheLocal && cacheServiciosJSON.datos) {
            console.log('⚡ Usando servicios desde cache local');
            return cacheServiciosJSON.datos;
        }
        
        // Intentar diferentes rutas posibles para GitHub Pages
        const rutas = [
            'servicios-iniciales.json',
            './servicios-iniciales.json',
            window.location.pathname.replace(/\/[^/]*$/, '/servicios-iniciales.json')
        ];
        
        let serviciosIniciales = [];
        let ultimoError = null;
        const ahora = Date.now();
        
        // Intentar cargar desde cada ruta con timeout de 5 segundos
        for (const ruta of rutas) {
            try {
                // Agregar timestamp a la URL para evitar caché del navegador
                const timestamp = Date.now();
                const rutaConTimestamp = `${ruta}?v=${timestamp}&_=${ahora}`;
                
                // Crear un timeout de 2 segundos para evitar que se quede colgado (reducido para mejor rendimiento)
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                
                try {
                    const response = await fetch(rutaConTimestamp, {
                        cache: 'no-cache',
                        headers: {
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache',
                            'Expires': '0'
                        },
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        serviciosIniciales = await response.json();
                        if (Array.isArray(serviciosIniciales) && serviciosIniciales.length > 0) {
                            // Guardar en cache
                            cacheServiciosJSON.datos = serviciosIniciales;
                            cacheServiciosJSON.timestamp = ahora;
                            cacheServiciosJSON.etag = response.headers.get('ETag');
                            
                            console.log(`📄 ${serviciosIniciales.length} servicios cargados desde ${ruta}`);
                            return serviciosIniciales;
                        }
                    }
                } catch (fetchError) {
                    clearTimeout(timeoutId);
                    if (fetchError.name === 'AbortError') {
                        console.warn(`Timeout al cargar ${ruta}`);
                    }
                    throw fetchError;
                }
            } catch (err) {
                ultimoError = err;
                continue; // Intentar siguiente ruta
            }
        }
        
        // Si falla todo, intentar usar cache anterior como fallback
        if (cacheServiciosJSON.datos) {
            console.warn('⚠️ No se pudo cargar JSON desde servidor, usando cache local');
            return cacheServiciosJSON.datos;
        }
        
        if (ultimoError) {
            console.warn('No se pudo cargar servicios-iniciales.json desde ninguna ruta:', ultimoError);
        }
        return [];
    } catch (error) {
        console.warn('Error al cargar servicios iniciales:', error);
        // Fallback a cache si existe
        return cacheServiciosJSON.datos || [];
    }
}

// Validar productos en segundo plano (sin bloquear la UI)
async function validarProductosEnSegundoPlano() {
    try {
        console.log('🔄 Validando productos con servidor en segundo plano...');
        const productosServidor = await cargarProductosIniciales(false);
        
        if (productosServidor && productosServidor.length > 0) {
            // Comparar con productos actuales para ver si hay cambios
            const productosActualesIds = new Set(productos.map(p => p.id));
            const productosServidorIds = new Set(productosServidor.map(p => p.id));
            
            // Verificar si hay diferencias
            const hayCambios = productos.length !== productosServidor.length ||
                !productos.every(p => productosServidorIds.has(p.id)) ||
                !productosServidor.every(p => productosActualesIds.has(p.id));
            
            if (hayCambios) {
                console.log('🔄 Se detectaron cambios en el servidor, actualizando productos...');
                productos = [...productosServidor];
                
                // Actualizar almacenamiento local
                await guardarEnIndexedDB(STORES.productos, productos);
                localStorage.setItem(STORAGE_KEYS.productos, JSON.stringify(productos));
                
                // Re-renderizar solo si estamos en la página de tienda
                const page = document.body.dataset.page || '';
                if (page === 'tienda' || page === 'tecnologia') {
                    renderListaProductosTienda();
                    renderFiltrosCategoria();
                } else if (page === 'admin') {
                    renderInventarioTabla();
                }
                
                console.log('✅ Productos actualizados desde servidor');
            } else {
                console.log('✅ Productos ya están actualizados');
            }
        }
    } catch (error) {
        console.warn('Error al validar productos en segundo plano:', error);
    }
}

async function cargarDatos() {
    try {
        // ESTRATEGIA OPTIMIZADA: Cargar desde localStorage primero (instantáneo)
        // Si no hay productos, cargar desde JSON inmediatamente (no esperar)
        // Luego actualizar desde JSON en segundo plano si ya hay productos
        
        // CARGAR DESDE LOCALSTORAGE PRIMERO (instantáneo, no bloquea)
        try {
            const p = JSON.parse(localStorage.getItem(STORAGE_KEYS.productos) || '[]');
            productos = Array.isArray(p) ? p : [];
            if (productos.length > 0) {
                console.log(`⚡ ${productos.length} productos cargados desde localStorage (instantáneo)`);
            }
        } catch (e) {
            console.warn('Error al cargar desde localStorage:', e);
            productos = [];
        }
        
        // Si NO hay productos en localStorage, intentar cargar desde JSON INMEDIATAMENTE
        // Esto es crítico para la primera carga
        if (productos.length === 0) {
            console.log('🔄 No hay productos en localStorage, cargando desde JSON inmediatamente...');
            try {
                // Intentar IndexedDB primero (más rápido que JSON)
                try {
                    await initIndexedDB();
                    const productosIDB = await cargarDeIndexedDB(STORES.productos);
                    if (productosIDB && productosIDB.length > 0) {
                        productos = productosIDB;
                        console.log(`✅ ${productos.length} productos cargados desde IndexedDB`);
                    }
                } catch (e) {
                    console.warn('Error al cargar desde IndexedDB:', e);
                }
                
                // Si aún no hay productos, cargar desde JSON INMEDIATAMENTE (sin esperar)
                if (productos.length === 0) {
                    // Mostrar overlay mientras carga
                    const page = document.body.dataset.page || '';
                    if (page === 'tienda' || page === 'tecnologia') {
                        mostrarLoadingOverlay();
                    }
                    
                    try {
                        // Intentar cargar desde JSON directamente (método optimizado con carga paralela)
                        console.log('🔄 Cargando productos desde JSON (primera carga)...');
                        const productosIniciales = await cargarProductosIniciales(false);
                        
                        if (productosIniciales && productosIniciales.length > 0) {
                            productos = [...productosIniciales];
                            console.log(`✅ ${productos.length} productos cargados desde JSON`);
                            
                            // Guardar en localStorage para próxima carga rápida
                            try {
                                localStorage.setItem(STORAGE_KEYS.productos, JSON.stringify(productos));
                            } catch (e) {
                                console.warn('No se pudo guardar en localStorage:', e);
                            }
                            
                            // Re-renderizar inmediatamente si estamos en la página de tienda
                            if (page === 'tienda' || page === 'tecnologia') {
                                renderListaProductosTienda();
                                ocultarLoadingOverlay();
                            }
                        } else {
                            // Si no hay productos, ocultar overlay
                            if (page === 'tienda' || page === 'tecnologia') {
                                renderListaProductosTienda(); // Renderizar mensaje vacío
                                ocultarLoadingOverlay();
                            }
                        }
                    } catch (e) {
                        console.warn('Error al cargar productos desde JSON:', e);
                        // Ocultar overlay incluso si hay error
                        const page = document.body.dataset.page || '';
                        if (page === 'tienda' || page === 'tecnologia') {
                            renderListaProductosTienda(); // Renderizar mensaje vacío
                            ocultarLoadingOverlay();
                        }
                    }
                }
            } catch (e) {
                console.warn('Error al cargar productos iniciales:', e);
            }
        } else {
            // Si YA hay productos en localStorage, actualizar desde JSON en segundo plano
            setTimeout(async () => {
                try {
                    console.log('🔄 Actualizando productos desde JSON en segundo plano...');
                    const productosIniciales = await cargarProductosIniciales(false);
                    
                    if (productosIniciales && productosIniciales.length > 0) {
                        // Verificar si hay cambios antes de actualizar
                        const hayCambios = productos.length !== productosIniciales.length ||
                            !productos.every(p => productosIniciales.some(pi => pi.id === p.id)) ||
                            !productosIniciales.every(pi => productos.some(p => p.id === pi.id));
                        
                        if (hayCambios) {
                            productos = [...productosIniciales];
                            console.log(`✅ ${productos.length} productos actualizados desde JSON`);
                            
                            // Guardar en localStorage para próxima carga rápida
                            try {
                                localStorage.setItem(STORAGE_KEYS.productos, JSON.stringify(productos));
                            } catch (e) {
                                console.warn('No se pudo guardar en localStorage:', e);
                            }
                            
                            // Re-renderizar solo si estamos en la página de tienda
                            const page = document.body.dataset.page || '';
                            if (page === 'tienda' || page === 'tecnologia') {
                                renderListaProductosTienda();
                                renderFiltrosCategoria();
                                ocultarLoadingOverlay(); // Asegurar que el overlay se oculte
                            } else if (page === 'admin') {
                                renderInventarioTabla();
                            }
                        } else {
                            console.log('✅ Productos ya están actualizados');
                        }
                    }
                } catch (e) {
                    console.warn('Error al cargar JSON en segundo plano (no crítico):', e);
                }
            }, 100); // Pequeño delay para no bloquear el renderizado inicial
        }
        
        // Guardar en IndexedDB en segundo plano (no bloquea)
        if (productos.length > 0) {
            setTimeout(async () => {
                try {
                    await initIndexedDB();
                    await migrarDesdeLocalStorage();
                    guardarEnIndexedDB(STORES.productos, productos).catch(e => {
                        console.warn('Error al guardar en IndexedDB (no crítico):', e);
                    });
                } catch (e) {
                    console.warn('IndexedDB no disponible (no crítico):', e);
                }
            }, 200);
        }

        // Cargar carrito desde localStorage primero (más confiable)
        try {
            const c = JSON.parse(localStorage.getItem(STORAGE_KEYS.carrito) || '[]');
            carrito = Array.isArray(c) ? c : [];
            console.log(`✅ Carrito cargado desde localStorage`);
        } catch (e) {
            console.warn('Error al cargar carrito desde localStorage, intentando IndexedDB:', e);
            try {
                await initIndexedDB();
                const carritoData = await cargarDeIndexedDB(STORES.carrito);
                carrito = carritoData.map(item => {
                    const { id, ...itemSinId } = item;
                    return itemSinId;
                });
                console.log(`✅ Carrito cargado de IndexedDB`);
            } catch (e2) {
                console.warn('Error al cargar carrito:', e2);
                carrito = [];
            }
        }

        // Cargar ventas desde localStorage primero (más confiable)
        try {
            const v = JSON.parse(localStorage.getItem(STORAGE_KEYS.ventas) || '[]');
            ventas = Array.isArray(v) ? v.map(venta => descomprimirVenta(venta)) : [];
            console.log(`✅ ${ventas.length} ventas cargadas desde localStorage`);
        } catch (e) {
            console.warn('Error al cargar ventas desde localStorage, intentando IndexedDB:', e);
            try {
                await initIndexedDB();
                const ventasData = await cargarDeIndexedDB(STORES.ventas);
                ventas = ventasData.map(venta => {
                    const { id, ...ventaSinId } = venta;
                    return { ...ventaSinId, id: venta.id };
                });
                console.log(`✅ ${ventas.length} ventas cargadas de IndexedDB`);
            } catch (e2) {
                console.warn('Error al cargar ventas:', e2);
                ventas = [];
            }
        }

        // Cargar créditos desde localStorage primero (más confiable)
        try {
            const c = JSON.parse(localStorage.getItem(STORAGE_KEYS.creditos) || '[]');
            creditos = Array.isArray(c) ? c : [];
            console.log(`✅ ${creditos.length} créditos cargados desde localStorage`);
        } catch (e) {
            console.warn('Error al cargar créditos desde localStorage, intentando IndexedDB:', e);
            try {
                await initIndexedDB();
                const creditosData = await cargarDeIndexedDB(STORES.creditos);
                creditos = creditosData.map(credito => {
                    const { id, ...creditoSinId } = credito;
                    return { ...creditoSinId, id: credito.id };
                });
                console.log(`✅ ${creditos.length} créditos cargados de IndexedDB`);
            } catch (e2) {
                console.warn('Error al cargar créditos:', e2);
                creditos = [];
            }
        }

        // Cargar tareas desde localStorage primero (más confiable)
        try {
            const t = JSON.parse(localStorage.getItem(STORAGE_KEYS.tareas) || '[]');
            tareas = Array.isArray(t) ? t : [];
            console.log(`✅ ${tareas.length} tareas cargadas desde localStorage`);
        } catch (e) {
            console.warn('Error al cargar tareas desde localStorage, intentando IndexedDB:', e);
            try {
                await initIndexedDB();
                const tareasData = await cargarDeIndexedDB(STORES.tareas);
                tareas = tareasData.map(tarea => {
                    const { id, ...tareaSinId } = tarea;
                    return { ...tareaSinId, id: tarea.id };
                });
                console.log(`✅ ${tareas.length} tareas cargadas de IndexedDB`);
            } catch (e2) {
                console.warn('Error al cargar tareas:', e2);
                tareas = [];
            }
        }

        // Cargar servicios desde localStorage primero (instantáneo)
        try {
            const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.servicios) || '[]');
            servicios = Array.isArray(s) ? s : [];
            if (servicios.length > 0) {
                console.log(`⚡ ${servicios.length} servicios cargados desde localStorage (instantáneo)`);
            }
        } catch (e) {
            console.warn('Error al cargar servicios desde localStorage, intentando IndexedDB:', e);
            try {
                await initIndexedDB();
                const serviciosData = await cargarDeIndexedDB(STORES.servicios);
                servicios = serviciosData.map(servicio => {
                    const { id, ...servicioSinId } = servicio;
                    return { ...servicioSinId, id: servicio.id };
                });
                console.log(`✅ ${servicios.length} servicios cargados de IndexedDB`);
            } catch (e2) {
                console.warn('Error al cargar servicios:', e2);
                servicios = [];
            }
        }
        
        // Cargar servicios desde JSON en segundo plano (no bloquea la UI)
        setTimeout(async () => {
            try {
                console.log('🔄 Actualizando servicios desde JSON en segundo plano...');
                const serviciosIniciales = await cargarServiciosIniciales(false);
                
                if (serviciosIniciales && serviciosIniciales.length > 0) {
                    // Verificar si hay cambios antes de actualizar
                    const hayCambios = servicios.length !== serviciosIniciales.length ||
                        !servicios.every(s => serviciosIniciales.some(si => si.id === s.id)) ||
                        !serviciosIniciales.every(si => servicios.some(s => s.id === si.id));
                    
                    if (hayCambios || servicios.length === 0) {
                        servicios = [...serviciosIniciales];
                        console.log(`✅ ${servicios.length} servicios actualizados desde JSON`);
                        
                        // Guardar en localStorage para próxima carga rápida
                        try {
                            localStorage.setItem(STORAGE_KEYS.servicios, JSON.stringify(servicios));
                        } catch (e) {
                            console.warn('No se pudo guardar servicios en localStorage:', e);
                        }
                        
                        // Re-renderizar solo si estamos en la página de servicios
                        const page = document.body.dataset.page || '';
                        if (page === 'servicios') {
                            renderServicios();
                            renderServiciosSolicitar();
                        } else if (page === 'admin') {
                            renderServiciosAdmin();
                        }
                    } else {
                        console.log('✅ Servicios ya están actualizados');
                    }
                }
            } catch (e) {
                console.warn('Error al cargar servicios JSON en segundo plano (no crítico):', e);
            }
        }, 150); // Pequeño delay para no bloquear el renderizado inicial
        
        // Guardar servicios en IndexedDB en segundo plano (no bloquea)
        if (servicios.length > 0) {
            setTimeout(async () => {
                try {
                    await initIndexedDB();
                    const serviciosObjetos = servicios.map(servicio => ({
                        id: servicio.id,
                        ...servicio
                    }));
                    guardarEnIndexedDB(STORES.servicios, serviciosObjetos).catch(e => {
                        console.warn('Error al guardar servicios en IndexedDB (no crítico):', e);
                    });
                } catch (e) {
                    console.warn('IndexedDB no disponible para servicios (no crítico):', e);
                }
            }, 250);
        }

        adminLogueado = localStorage.getItem(STORAGE_KEYS.adminLogged) === 'true';
        
    } catch (error) {
        console.error('Error crítico al cargar datos:', error);
        // Fallback completo - intentar cargar desde localStorage
        try {
            const p = JSON.parse(localStorage.getItem(STORAGE_KEYS.productos) || '[]');
            productos = Array.isArray(p) ? p : [];
            console.log(`✅ ${productos.length} productos cargados desde localStorage (fallback)`);
        } catch (e) {
            console.error('Error crítico al cargar productos:', e);
            productos = [];
        }
        
        try {
            const c = JSON.parse(localStorage.getItem(STORAGE_KEYS.carrito) || '[]');
            carrito = Array.isArray(c) ? c : [];
        } catch { carrito = []; }
        
        try {
            const v = JSON.parse(localStorage.getItem(STORAGE_KEYS.ventas) || '[]');
            ventas = Array.isArray(v) ? v : [];
        } catch { ventas = []; }
        
        adminLogueado = localStorage.getItem(STORAGE_KEYS.adminLogged) === 'true';
    }
}


/* ============================================================
   VARIANTES PRO (precio, imagen, stock) - Helpers
   - Compatible con variantes antiguas (array de strings)
============================================================ */
function normalizarVariantes(variantes) {
    if (!Array.isArray(variantes)) return [];
    return variantes
        .map(v => {
            if (typeof v === 'string') {
                const s = v.trim();
                if (!s) return null;
                return { id: s, nombre: s, precio: 0, imagen: '', stock: null, sku: '' };
            }
            if (v && typeof v === 'object') {
                const id = String(v.id || v.nombre || '').trim();
                const nombre = String(v.nombre || v.id || '').trim();
                if (!id && !nombre) return null;
                return {
                    id: id || nombre,
                    nombre: nombre || id,
                    precio: Number(v.precio) || 0,
                    imagen: String(v.imagen || '').trim(),
                    stock: (v.stock === 0 || v.stock) ? Number(v.stock) : null,
                    sku: String(v.sku || '').trim()
                };
            }
            return null;
        })
        .filter(Boolean);
}

function obtenerVariantePorId(producto, idVar) {
    const vars = normalizarVariantes(producto.variantes || []);
    return vars.find(v => String(v.id) === String(idVar)) || null;
}

// Normalizar ruta de imagen para GitHub Pages y local (asegurar que sea relativa correcta)
function normalizarRutaImagen(ruta) {
    if (!ruta || ruta === '0' || ruta === '') {
        return 'https://via.placeholder.com/400x400?text=Producto';
    }
    
    // Si ya es una URL completa, devolverla tal cual
    if (ruta.startsWith('http://') || ruta.startsWith('https://') || ruta.startsWith('data:')) {
        return ruta;
    }
    
    // Si empieza con /, mantenerla así (ruta absoluta desde raíz)
    if (ruta.startsWith('/')) {
        return ruta;
    }
    
    // Para rutas relativas, asegurar que funcionen tanto localmente como en GitHub Pages
    // Obtener la ruta base del documento actual
    const currentPath = window.location.pathname;
    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
    
    // Si la ruta no empieza con ./ o ../, construir la ruta completa
    if (!ruta.startsWith('./') && !ruta.startsWith('../')) {
        // En GitHub Pages o servidor, usar ruta relativa desde la raíz
        if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
            // Si la ruta base tiene subdirectorios, construir la ruta relativa
            if (basePath && basePath !== '/') {
                return basePath + ruta;
            }
            return ruta;
        } else {
            // En local (file://), usar ruta relativa con ./
            return './' + ruta;
        }
    }
    
    // Si ya tiene ./ o ../, construir la ruta completa si es necesario
    if (window.location.protocol === 'file:' && !ruta.startsWith('../')) {
        // En local, asegurar que ./ funcione correctamente
        return ruta;
    }
    
    return ruta;
}

function getImagenParaCarrito(producto, varianteObj) {
    const imagen = (varianteObj && varianteObj.imagen) || producto.imagenPrincipal || (producto.imagenesExtra && producto.imagenesExtra[0]) || '';
    return normalizarRutaImagen(imagen);
}

/* -------- Admin: editor visual de variantes -------- */
function crearFilaVarianteEditor(datos) {
    const v = {
        id: String(datos?.id || datos?.nombre || '').trim(),
        nombre: String(datos?.nombre || datos?.id || '').trim(),
        precio: Number(datos?.precio) || 0,
        imagen: String(datos?.imagen || '').trim(),
        stock: (datos?.stock === 0 || datos?.stock) ? Number(datos.stock) : null,
        sku: String(datos?.sku || '').trim()
    };

    const row = document.createElement('div');
    row.className = 'var-row';

    const inpNombre = document.createElement('input');
    inpNombre.type = 'text';
    inpNombre.placeholder = 'Nombre (ej: Rojo / Unicornio)';
    inpNombre.value = v.nombre || v.id;
    inpNombre.dataset.role = 'nombre';

    const inpPrecio = document.createElement('input');
    inpPrecio.type = 'number';
    inpPrecio.min = '0';
    inpPrecio.step = '50';
    inpPrecio.placeholder = 'Precio (0 = usa general)';
    inpPrecio.value = v.precio || 0;
    inpPrecio.dataset.role = 'precio';

    const inpImagen = document.createElement('input');
    inpImagen.type = 'text';
    inpImagen.placeholder = 'URL imagen (opcional)';
    inpImagen.value = v.imagen || '';
    inpImagen.dataset.role = 'imagen';
    inpImagen.className = 'var-col-wide';

    const inpStock = document.createElement('input');
    inpStock.type = 'number';
    inpStock.min = '0';
    inpStock.step = '1';
    inpStock.placeholder = 'Stock (opcional)';
    inpStock.value = (v.stock === null || Number.isNaN(v.stock)) ? '' : v.stock;
    inpStock.dataset.role = 'stock';

    const inpSku = document.createElement('input');
    inpSku.type = 'text';
    inpSku.placeholder = 'SKU / código opcional';
    inpSku.value = v.sku || '';
    inpSku.dataset.role = 'sku';

    const thumb = document.createElement('img');
    thumb.className = 'var-thumb';
    thumb.alt = 'img';
    thumb.src = v.imagen ? v.imagen : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="#fff7e6"/><text x="50%" y="52%" font-size="10" text-anchor="middle" fill="#999">IMG</text></svg>');

    const chip = document.createElement('div');
    chip.className = 'var-chip';
    chip.appendChild(thumb);
    chip.appendChild(inpImagen);

    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.className = 'btn btn-danger var-remove';
    btnRemove.textContent = '✖';
    btnRemove.title = 'Eliminar variante';
    btnRemove.addEventListener('click', () => {
        row.remove();
        syncVariantesEditorToTextarea();
    });

    // live preview
    inpImagen.addEventListener('input', () => {
        const url = inpImagen.value.trim();
        if (url) thumb.src = url;
        syncVariantesEditorToTextarea();
    });

    [inpNombre, inpPrecio, inpStock, inpSku].forEach(el => {
        el.addEventListener('input', syncVariantesEditorToTextarea);
    });

    row.appendChild(inpNombre);
    row.appendChild(inpPrecio);
    row.appendChild(chip);
    row.appendChild(inpStock);
    row.appendChild(inpSku);
    row.appendChild(btnRemove);
    return row;
}

function leerVariantesDesdeEditor() {
    const cont = document.getElementById('variantesEditor');
    if (!cont) return [];
    const rows = Array.from(cont.querySelectorAll('.var-row'));
    const arr = rows.map(r => {
        const nombre = (r.querySelector('[data-role="nombre"]')?.value || '').trim();
        const precio = Number(r.querySelector('[data-role="precio"]')?.value) || 0;
        const imagen = (r.querySelector('[data-role="imagen"]')?.value || '').trim();
        const stockRaw = (r.querySelector('[data-role="stock"]')?.value || '').trim();
        const stock = stockRaw === '' ? null : (Number(stockRaw) || 0);
        const sku = (r.querySelector('[data-role="sku"]')?.value || '').trim();

        const id = nombre || ('var_' + Math.random().toString(16).slice(2, 8));
        if (!id) return null;
        return { id, nombre: nombre || id, precio, imagen, stock, sku };
    }).filter(Boolean);

    // dedupe ids
    const seen = new Set();
    const out = [];
    for (const v of arr) {
        let id = String(v.id || v.nombre).trim();
        if (!id) continue;
        if (seen.has(id)) {
            id = id + '_' + Math.random().toString(16).slice(2, 5);
            v.id = id;
        }
        seen.add(id);
        out.push(v);
    }
    return out;
}

function syncVariantesEditorToTextarea() {
    const ta = document.getElementById('variantesProducto');
    if (!ta) return;
    const arr = leerVariantesDesdeEditor();
    ta.value = arr.length ? JSON.stringify(arr) : '';
}

function pintarEditorVariantes(variantes) {
    const cont = document.getElementById('variantesEditor');
    if (!cont) return;
    cont.innerHTML = '';
    const vars = normalizarVariantes(variantes || []);
    vars.forEach(v => cont.appendChild(crearFilaVarianteEditor(v)));
    syncVariantesEditorToTextarea();
}

function initVariantesEditorAdmin() {
    const cont = document.getElementById('variantesEditor');
    if (!cont) return; // no admin page
    const btnAdd = document.getElementById('btnAddVariante');
    const btnAuto = document.getElementById('btnAutoVarDesdeTexto');
    const btnClear = document.getElementById('btnLimpiarVariantes');
    const ta = document.getElementById('variantesProducto');

    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            cont.appendChild(crearFilaVarianteEditor({ nombre: '' }));
            syncVariantesEditorToTextarea();
        });
    }
    if (btnAuto) {
        btnAuto.addEventListener('click', () => {
            const ejemplo = prompt('Escribe las variantes separadas por coma (ej: rojo, azul, verde):', '');
            if (ejemplo === null) return;
            const lista = ejemplo.split(',').map(s => s.trim()).filter(Boolean).map(s => ({ id: s, nombre: s, precio: 0, imagen: '', stock: null }));
            pintarEditorVariantes(lista);
        });
    }
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (!confirm('¿Borrar todas las variantes de este producto?')) return;
            cont.innerHTML = '';
            if (ta) ta.value = '';
        });
    }

    // if textarea already has json, try load it
    if (ta && ta.value && ta.value.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(ta.value.trim());
            pintarEditorVariantes(parsed);
        } catch { /* ignore */ }
    }
}

/* ============================================================
   CATEGORÍAS & FILTROS
============================================================ */
function obtenerCategorias() {
    const set = new Set();
    productos.forEach(p => {
        if (p.categoria && p.categoria.trim() !== '') {
            set.add(p.categoria.trim());
        }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

function renderFiltrosCategoria() {
    const select = document.getElementById('filtroCategoria');
    if (!select) return;
    
    // Detectar si estamos en la página de tecnología o tienda
    const esPaginaTecnologia = document.body.dataset.page === 'tecnologia';
    const esPaginaTienda = document.body.dataset.page === 'tienda';
    
    let categorias = obtenerCategorias();
    
    // Si estamos en tecnología.html, filtrar solo categorías de productos de tecnología
    if (esPaginaTecnologia) {
        const productosTecnologia = productos.filter(p => {
            const cat = (p.categoria || '').toLowerCase().trim();
            return cat === 'tecnologia' || cat === 'tecnología';
        });
        const setCats = new Set();
        productosTecnologia.forEach(p => {
            if (p.categoria && p.categoria.trim() !== '') {
                setCats.add(p.categoria.trim());
            }
        });
        categorias = Array.from(setCats).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    }
    
    // Si estamos en tienda.html, excluir categoría de tecnología
    if (esPaginaTienda) {
        categorias = categorias.filter(cat => {
            const catLower = cat.toLowerCase().trim();
            return catLower !== 'tecnologia' && catLower !== 'tecnología';
        });
    }
    
    const valorActual = select.value;
    select.innerHTML = '<option value="">Todas</option>';
    categorias.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });
    if (valorActual) {
        select.value = valorActual;
    }
}

// Datalist de categorías en admin (para reutilizar categorías existentes)
function renderDatalistCategoriasAdmin() {
    const dataList = document.getElementById('listaCategorias');
    if (!dataList) return;
    const cats = obtenerCategorias();
    dataList.innerHTML = '';
    cats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        dataList.appendChild(opt);
    });
}

/* ============================================================
   TIENDA - GRID PRODUCTOS TIPO SHOPEE
============================================================ */
function renderListaProductosTienda() {
    const grid = document.getElementById('productosGrid');
    const mensajeVacio = document.getElementById('productosVacios');
    if (!grid || !mensajeVacio) return;

    grid.innerHTML = '';

    // Detectar si estamos en la página de tecnología
    const esPaginaTecnologia = document.body.dataset.page === 'tecnologia';
    const esPaginaTienda = document.body.dataset.page === 'tienda';
    
    let lista = [...productos];
    
    // Si estamos en tecnología.html, filtrar solo productos de categoría "tecnologia"
    if (esPaginaTecnologia) {
        lista = lista.filter(p => {
            const cat = (p.categoria || '').toLowerCase().trim();
            return cat === 'tecnologia' || cat === 'tecnología';
        });
    }
    
    // Si estamos en tienda.html, excluir productos de tecnología
    if (esPaginaTienda) {
        lista = lista.filter(p => {
            const cat = (p.categoria || '').toLowerCase().trim();
            return cat !== 'tecnologia' && cat !== 'tecnología';
        });
    }
    
    const textoInput = document.getElementById('filtroBusqueda');
    const categoriaSelect = document.getElementById('filtroCategoria');
    const ordenSelect = document.getElementById('filtroOrden');

    const texto = textoInput ? textoInput.value.trim().toLowerCase() : '';
    const categoria = categoriaSelect ? categoriaSelect.value : '';
    const orden = ordenSelect ? ordenSelect.value : 'nombre-asc';

    if (texto) {
        lista = lista.filter(p => {
            return (
                (p.nombre || '').toLowerCase().includes(texto) ||
                (p.descripcion || '').toLowerCase().includes(texto) ||
                (p.categoria || '').toLowerCase().includes(texto) ||
                (p.sku || '').toLowerCase().includes(texto)
            );
        });
    }

    if (categoria) {
        lista = lista.filter(p => (p.categoria || '') === categoria);
    }

    lista.sort((a, b) => {
        switch (orden) {
            case 'nombre-asc':
                return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
            case 'nombre-desc':
                return (b.nombre || '').localeCompare(a.nombre || '', 'es', { sensitivity: 'base' });
            case 'precio-asc':
                return (Number(a.precioVenta) || 0) - (Number(b.precioVenta) || 0);
            case 'precio-desc':
                return (Number(b.precioVenta) || 0) - (Number(a.precioVenta) || 0);
            default:
                return 0;
        }
    });

    if (lista.length === 0) {
        mensajeVacio.style.display = 'block';
        return;
    } else {
        mensajeVacio.style.display = 'none';
    }

    // Optimización: usar DocumentFragment para renderizar más rápido
    const fragment = document.createDocumentFragment();
    
    lista.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';

        // Imagen con lazy loading para mejorar rendimiento
        const imgC = document.createElement('div');
        imgC.className = 'product-img-container';
        const img = document.createElement('img');
        img.className = 'product-img';
        img.loading = 'lazy'; // Lazy loading nativo del navegador
        img.alt = p.nombre || 'Producto';
        // Placeholder mientras carga
        img.style.backgroundColor = '#f0f0f0';
        
        // Manejar errores de carga de imagen
        img.onerror = function() {
            // Si falla la imagen, usar placeholder
            this.src = 'https://via.placeholder.com/400x400?text=Sin+imagen';
            this.style.backgroundColor = '#e0e0e0';
        };
        
        // Intentar cargar la imagen
        const rutaImagen = normalizarRutaImagen(p.imagenPrincipal);
        img.src = rutaImagen;
        
        imgC.appendChild(img);
        
        // Verificar si está agotado y agregar letrero
        const tieneVariantes = normalizarVariantes(p.variantes || []).length > 0;
        let estaAgotado = false;
        
        if (tieneVariantes) {
            // Si tiene variantes, verificar si todas están agotadas
            const vars = normalizarVariantes(p.variantes || []);
            // Solo considerar variantes con stock definido (stock === 0 o stock > 0)
            const variantesConStockDefinido = vars.filter(v => (v.stock === 0 || v.stock));
            if (variantesConStockDefinido.length > 0) {
                // Si hay variantes con stock definido, verificar si todas están en 0
                const variantesConStock = variantesConStockDefinido.filter(v => Number(v.stock) > 0);
                estaAgotado = variantesConStock.length === 0;
            } else {
                // Si ninguna variante tiene stock definido, no mostrar como agotado
                estaAgotado = false;
            }
        } else {
            // Si no tiene variantes, verificar stock del producto principal
            const stockNum = Number(p.stock) || 0;
            estaAgotado = stockNum === 0;
        }
        
        if (estaAgotado) {
            const letreroAgotado = document.createElement('div');
            letreroAgotado.className = 'product-out-of-stock-badge';
            letreroAgotado.textContent = 'AGOTADO';
            imgC.appendChild(letreroAgotado);
        }
        
        card.appendChild(imgC);

        // Info
        const info = document.createElement('div');
        info.className = 'product-info';

        const title = document.createElement('div');
        title.className = 'product-title';
        title.textContent = p.nombre || 'Sin nombre';
        info.appendChild(title);

        if (p.etiquetaVerde) {
            const badge = document.createElement('div');
            badge.className = 'product-badge-green';
            badge.textContent = p.etiquetaVerde;
            info.appendChild(badge);
        }

        // Precios / promo
        const precios = document.createElement('div');
        precios.className = 'product-prices';

        const precioBase = Number(p.precioVenta) || 0;
        const precioPromo = p.promoActiva && p.precioPromo ? Number(p.precioPromo) : precioBase;
        const precioAnterior = p.precioAnterior ? Number(p.precioAnterior) : (p.promoActiva ? precioBase : 0);

        const spanActual = document.createElement('span');
        spanActual.className = 'product-price-main';
        spanActual.textContent = formatoPrecio(precioPromo);
        precios.appendChild(spanActual);

        if (precioAnterior && precioAnterior > precioPromo) {
            const spanOld = document.createElement('span');
            spanOld.className = 'product-price-old';
            spanOld.textContent = formatoPrecio(precioAnterior);
            precios.appendChild(spanOld);
        }

        info.appendChild(precios);

        // Ventas - solo mostrar si es mayor que 0
        if (p.ventas && Number(p.ventas) > 0) {
            const vent = document.createElement('div');
            vent.className = 'product-sales';
            vent.textContent = `${p.ventas}+ ventas`;
            info.appendChild(vent);
        }

        // Oferta opcional
        if (p.promoActiva && p.promoTexto) {
            const offer = document.createElement('div');
            offer.className = 'product-offer';
            const left = document.createElement('span');
            left.className = 'product-offer-left';
            left.textContent = p.promoTexto;
            const right = document.createElement('span');
            right.className = 'product-offer-right';
            if (precioAnterior && precioAnterior > precioPromo) {
                const desc = Math.round(100 - (precioPromo * 100 / precioAnterior));
                right.textContent = `-${desc}%`;
            } else {
                right.textContent = 'Promo';
            }
            offer.appendChild(left);
            offer.appendChild(right);
            info.appendChild(offer);
        }

        // Mostrar variables (máximo 3)
        const vars = normalizarVariantes(p.variantes || []);
        if (vars.length > 0) {
            const varsContainer = document.createElement('div');
            varsContainer.className = 'product-variants-preview';
            const varsMostrar = vars.slice(0, 3);
            varsMostrar.forEach((v, idx) => {
                const varBadge = document.createElement('span');
                varBadge.className = 'product-variant-badge';
                varBadge.textContent = v.nombre;
                varsContainer.appendChild(varBadge);
                if (idx < varsMostrar.length - 1) {
                    varsContainer.appendChild(document.createTextNode(' '));
                }
            });
            if (vars.length > 3) {
                const masBadge = document.createElement('span');
                masBadge.className = 'product-variant-badge product-variant-more';
                masBadge.textContent = `+${vars.length - 3} más`;
                varsContainer.appendChild(document.createTextNode(' '));
                varsContainer.appendChild(masBadge);
            }
            info.appendChild(varsContainer);
        }

        // Stock bajo - solo mostrar si NO tiene variantes
        if (!tieneVariantes) {
            const stockNum = Number(p.stock) || 0;
            if (stockNum > 0 && stockNum <= 5) {
                const st = document.createElement('div');
                st.className = 'product-stock-low';
                st.textContent = `SOLO QUEDAN ${stockNum}`;
                info.appendChild(st);
            }
        }

        // Acciones
        const actions = document.createElement('div');
        actions.className = 'product-card-actions';

        const btnVer = document.createElement('a');
        btnVer.className = 'btn btn-secondary btn-sm btn-ver';
        btnVer.textContent = 'Ver detalles';
        btnVer.href = `producto.html?id=${encodeURIComponent(p.id)}`;

        const btnCart = document.createElement('button');
        btnCart.className = 'product-cart-btn';
        btnCart.title = 'Agregar al carrito';
        const cartIcon = document.createElement('img');
        cartIcon.src = 'carrito.png';
        cartIcon.alt = 'Agregar al carrito';
        cartIcon.className = 'product-cart-icon';
        btnCart.appendChild(cartIcon);
        btnCart.addEventListener('click', () => {
            const vars = normalizarVariantes(p.variantes || []);
            if (vars.length) {
                // Si tiene variantes, abrir modal para elegir variante y cantidad
                abrirModalVariantes(p);
            } else {
                // Sin variantes, agregar 1 unidad directo
                agregarAlCarrito(p.id, 'unidad', 1, null);
            }
        });

        actions.appendChild(btnVer);
        actions.appendChild(btnCart);
        info.appendChild(actions);

        card.appendChild(info);
        fragment.appendChild(card);
    });
    
    // Agregar todos los elementos de una vez (más eficiente que uno por uno)
    grid.appendChild(fragment);
    
    // Ocultar overlay de carga DESPUÉS de que los productos se hayan agregado al DOM
    // Usar requestAnimationFrame para asegurar que el DOM se actualice primero
    requestAnimationFrame(() => {
        setTimeout(() => {
            ocultarLoadingOverlay();
        }, 100);
    });
}

// Variable para rastrear si ya se ocultó el overlay
let overlayOcultado = false;

// Función para ocultar el overlay de carga
function ocultarLoadingOverlay() {
    if (overlayOcultado) return; // Ya se ocultó, no hacer nada
    
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlayOcultado = true;
        overlay.classList.add('hidden');
        // Remover completamente después de la animación
        setTimeout(() => {
            if (overlay) {
                overlay.style.display = 'none';
            }
        }, 500);
    }
}

// Función para mostrar el overlay de carga
function mostrarLoadingOverlay() {
    overlayOcultado = false; // Resetear el flag
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.classList.remove('hidden');
    }
}

// Función para invalidar cache cuando se actualiza el archivo
function invalidarCacheProductos() {
    cacheProductosJSON = {
        datos: null,
        timestamp: 0,
        etag: null
    };
    console.log('🧹 Cache de productos invalidado');
}

/* ============================================================
   CARRITO (TIENDA + PRODUCTO)
============================================================ */

// Buscar por código (producto o variante) y agregar al carrito automáticamente
function buscarYAgregarPorCodigo(codigoCrudo) {
    if (!codigoCrudo) return false;
    const codigo = String(codigoCrudo).trim().toLowerCase();
    if (!codigo) return false;

    // Primero SKU de producto
    const prodPorSku = productos.find(p => (p.sku || '').toLowerCase() === codigo);
    if (prodPorSku) {
        agregarAlCarrito(prodPorSku.id, 'unidad', 1, null);
        return true;
    }

    // Luego SKU de variante
    for (const p of productos) {
        const vars = normalizarVariantes(p.variantes || []);
        const v = vars.find(vv => (vv.sku || '').toLowerCase() === codigo);
        if (v) {
            agregarAlCarrito(p.id, 'unidad', 1, v);
            return true;
        }
    }
    return false;
}

// Modal para seleccionar variante y cantidad desde la tienda
function abrirModalVariantes(producto) {
    const variantesNorm = normalizarVariantes(producto.variantes || []);
    if (!variantesNorm.length) {
        // Si no hay variantes normalizadas, usar comportamiento normal
        agregarAlCarrito(producto.id, 'unidad', 1, null);
        return;
    }

    // Si ya existe un modal abierto, lo removemos
    const existente = document.querySelector('.modal-overlay');
    if (existente) existente.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const card = document.createElement('div');
    card.className = 'modal-card';

    // Imagen cabecera
    const imgHeader = document.createElement('img');
    imgHeader.className = 'modal-header-img';
    imgHeader.src =
        getImagenParaCarrito(producto, variantesNorm[0]) ||
        producto.imagenPrincipal ||
        (producto.imagenesExtra && producto.imagenesExtra[0]) ||
        'https://via.placeholder.com/400x400?text=Producto';
    card.appendChild(imgHeader);

    const btnCerrar = document.createElement('button');
    btnCerrar.className = 'modal-close-btn';
    btnCerrar.textContent = '✖';
    btnCerrar.addEventListener('click', () => overlay.remove());
    card.appendChild(btnCerrar);

    const body = document.createElement('div');
    body.className = 'modal-body';

    const titulo = document.createElement('div');
    titulo.className = 'modal-titulo';
    titulo.textContent = producto.nombre || 'Producto';
    body.appendChild(titulo);

    const gridVars = document.createElement('div');
    gridVars.className = 'modal-variantes-grid';

    const precioBase = Number(producto.precioVenta) || 0;
    const precioPromo = producto.promoActiva && producto.precioPromo ? Number(producto.precioPromo) : precioBase;

    let varianteSeleccionada = variantesNorm[0];

    const cardsInfo = [];
    variantesNorm.forEach((v, idx) => {
        const cardVar = document.createElement('div');
        cardVar.className = 'modal-var-card' + (idx === 0 ? ' activa' : '');

        // Contenedor para la imagen con letrero de agotado
        const imgContainer = document.createElement('div');
        imgContainer.className = 'modal-var-img-container';
        
        const img = document.createElement('img');
        img.src = v.imagen || getImagenParaCarrito(producto, v);
        imgContainer.appendChild(img);
        
        // Verificar si la variante está agotada
        const stockVariante = (v.stock === 0 || v.stock) ? Number(v.stock) : null;
        if (stockVariante !== null && stockVariante === 0) {
            const letreroAgotado = document.createElement('div');
            letreroAgotado.className = 'modal-var-out-of-stock';
            letreroAgotado.textContent = 'AGOTADO';
            imgContainer.appendChild(letreroAgotado);
        }
        
        cardVar.appendChild(imgContainer);

        const nombre = document.createElement('div');
        nombre.className = 'modal-var-nombre';
        nombre.textContent = v.nombre;
        cardVar.appendChild(nombre);

        const precioLinea = document.createElement('div');
        const spanActual = document.createElement('span');
        spanActual.className = 'modal-var-precio';
        precioLinea.appendChild(spanActual);

        const spanOld = document.createElement('span');
        spanOld.className = 'modal-var-precio-old';
        spanOld.style.marginLeft = '4px';
        precioLinea.appendChild(spanOld);

        cardsInfo.push({ spanActual, spanOld, variante: v });

        cardVar.appendChild(precioLinea);

        // Mini carrito por variante: botón rápido para añadir 1 unidad
        const miniRow = document.createElement('div');
        miniRow.className = 'modal-var-mini';
        const miniBtn = document.createElement('button');
        miniBtn.type = 'button';
        miniBtn.textContent = '🛒 +1';
        
        // Deshabilitar botón si está agotado
        if (stockVariante !== null && stockVariante === 0) {
            miniBtn.disabled = true;
            miniBtn.style.opacity = '0.5';
            miniBtn.style.cursor = 'not-allowed';
        } else {
            miniBtn.addEventListener('click', (ev) => {
                ev.stopPropagation(); // no cambiar selección al usar el mini carrito
                agregarAlCarrito(producto.id, 'unidad', 1, v);
            });
        }
        
        miniRow.appendChild(miniBtn);
        cardVar.appendChild(miniRow);

        // Guardar referencia a la variante para el evento click
        cardVar.addEventListener('click', () => {
            document.querySelectorAll('.modal-var-card').forEach(el => el.classList.remove('activa'));
            cardVar.classList.add('activa');
            varianteSeleccionada = v;
            imgHeader.src = v.imagen || getImagenParaCarrito(producto, v);
            actualizarPrecioTipo();
        });

        gridVars.appendChild(cardVar);
    });

    body.appendChild(gridVars);

    // Tipo de venta (unidad / pack)
    const rowTipo = document.createElement('div');
    rowTipo.className = 'modal-cantidad-row';
    const lblTipo = document.createElement('span');
    lblTipo.textContent = 'Tipo de compra:';
    rowTipo.appendChild(lblTipo);

    const selectTipo = document.createElement('select');
    const optU = document.createElement('option');
    optU.value = 'unidad';
    optU.textContent = 'Unidad';
    selectTipo.appendChild(optU);
    if (producto.packCantidad && producto.packCantidad > 0 && producto.packPrecio && producto.packPrecio > 0) {
        const optP = document.createElement('option');
        optP.value = 'pack';
        optP.textContent = `Pack x${producto.packCantidad}`;
        selectTipo.appendChild(optP);
    }
    rowTipo.appendChild(selectTipo);

    const spanPrecioTipo = document.createElement('span');
    spanPrecioTipo.className = 'small text-muted';
    rowTipo.appendChild(spanPrecioTipo);

    body.appendChild(rowTipo);

    // Cantidad
    const rowCant = document.createElement('div');
    rowCant.className = 'modal-cantidad-row';

    const lblCant = document.createElement('span');
    lblCant.textContent = 'Cantidad:';
    rowCant.appendChild(lblCant);

    const cantControls = document.createElement('div');
    cantControls.className = 'modal-cant-controls';

    const btnMenos = document.createElement('button');
    btnMenos.type = 'button';
    btnMenos.textContent = '−';

    const inputCant = document.createElement('input');
    inputCant.type = 'number';
    inputCant.min = '1';
    inputCant.value = '1';

    const btnMas = document.createElement('button');
    btnMas.type = 'button';
    btnMas.textContent = '+';

    btnMenos.addEventListener('click', () => {
        const v = Math.max(1, (Number(inputCant.value) || 1) - 1);
        inputCant.value = String(v);
    });
    btnMas.addEventListener('click', () => {
        const v = (Number(inputCant.value) || 1) + 1;
        inputCant.value = String(v);
    });

    cantControls.appendChild(btnMenos);
    cantControls.appendChild(inputCant);
    cantControls.appendChild(btnMas);
    rowCant.appendChild(cantControls);
    body.appendChild(rowCant);

    const btnAdd = document.createElement('button');
    btnAdd.type = 'button';
    btnAdd.className = 'btn btn-primary btn-full modal-btn-add';
    btnAdd.textContent = '🛒 Agregar al carrito';
    // Función auxiliar para mostrar precio según tipo
    const actualizarPrecioTipo = () => {
        const tipo = selectTipo.value || 'unidad';
        let precioMostrar;
        if (tipo === 'pack') {
            precioMostrar = Number(producto.packPrecio) || 0;
            spanPrecioTipo.textContent = precioMostrar
                ? 'Precio pack: ' + formatoPrecio(precioMostrar)
                : '';
            // Actualizar precios en las tarjetas de variantes al precio del pack
            cardsInfo.forEach(info => {
                info.spanActual.textContent = formatoPrecio(precioMostrar || 0);
                info.spanOld.textContent = '';
            });
        } else {
            const base = Number(producto.precioVenta) || 0;
            const promo = producto.promoActiva && producto.precioPromo ? Number(producto.precioPromo) : base;
            // Si hay promoción activa, usar siempre el precio promocional para todas las variantes
            // Si no hay promoción, usar el precio de la variante si existe, sino el precio base
            const precioVarSel = varianteSeleccionada ? (Number(varianteSeleccionada.precio) || 0) : 0;
            precioMostrar = producto.promoActiva ? promo : (precioVarSel > 0 ? precioVarSel : base);
            spanPrecioTipo.textContent = 'Precio unidad: ' + formatoPrecio(precioMostrar);
            // Actualizar precios de cada tarjeta de variante
            cardsInfo.forEach(info => {
                const v = info.variante;
                const precioVar = Number(v.precio) || 0;
                // Si hay promoción activa, siempre usar el precio promocional
                const precioCard = producto.promoActiva ? promo : (precioVar > 0 ? precioVar : base);
                info.spanActual.textContent = formatoPrecio(precioCard);
                // Mostrar precio anterior solo si no hay promoción activa
                if (!producto.promoActiva && precioVar > 0 && precioVar < base) {
                    info.spanOld.textContent = formatoPrecio(base);
                } else if (producto.promoActiva && promo < base) {
                    info.spanOld.textContent = formatoPrecio(base);
                } else {
                    info.spanOld.textContent = '';
                }
            });
        }
    };

    selectTipo.addEventListener('change', actualizarPrecioTipo);
    actualizarPrecioTipo();

    // Función para verificar si la variante está agotada y actualizar el botón
    const actualizarEstadoBoton = () => {
        const stockVar = varianteSeleccionada && (varianteSeleccionada.stock === 0 || varianteSeleccionada.stock) 
            ? Number(varianteSeleccionada.stock) : null;
        const estaAgotada = stockVar !== null && stockVar === 0;
        
        if (estaAgotada) {
            btnAdd.disabled = true;
            btnAdd.style.opacity = '0.5';
            btnAdd.style.cursor = 'not-allowed';
            btnAdd.textContent = '🛒 Agotado';
        } else {
            btnAdd.disabled = false;
            btnAdd.style.opacity = '1';
            btnAdd.style.cursor = 'pointer';
            btnAdd.textContent = '🛒 Agregar al carrito';
        }
    };
    
    // Actualizar eventos de las tarjetas para que también actualicen el botón
    document.querySelectorAll('.modal-var-card').forEach((cardVar, idx) => {
        const varianteOriginal = variantesNorm[idx];
        // Agregar listener adicional para actualizar el botón
        cardVar.addEventListener('click', () => {
            // Pequeño delay para asegurar que varianteSeleccionada se actualizó
            setTimeout(() => {
                actualizarEstadoBoton();
            }, 10);
        });
    });
    
    // Verificar estado inicial
    actualizarEstadoBoton();
    
    btnAdd.addEventListener('click', () => {
        const stockVar = varianteSeleccionada && (varianteSeleccionada.stock === 0 || varianteSeleccionada.stock) 
            ? Number(varianteSeleccionada.stock) : null;
        if (stockVar !== null && stockVar === 0) {
            alert('Esta variante está agotada.');
            return;
        }
        
        const cant = Math.max(1, Number(inputCant.value) || 1);
        const tipoVenta = selectTipo.value || 'unidad';
        agregarAlCarrito(producto.id, tipoVenta, cant, varianteSeleccionada);
        overlay.remove();
        alert('Producto agregado al carrito.');
    });

    body.appendChild(btnAdd);

    card.appendChild(body);
    overlay.appendChild(card);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    document.body.appendChild(overlay);
}

function agregarAlCarrito(idProducto, tipo, cantidad, varianteSeleccionada) {
    const producto = productos.find(p => p.id === idProducto);
    if (!producto) return;

    if (tipo === 'unidad') {
        if (!producto.precioVenta || producto.precioVenta <= 0) {
            alert('Este producto no tiene precio de venta por unidad configurado.');
            return;
        }
    } else if (tipo === 'pack') {
        if (!producto.packCantidad || !producto.packPrecio) {
            alert('Este producto no tiene pack configurado.');
            return;
        }
    }

    let varianteObj = null;
    let claveVar = '';
    let varianteNombre = '';
    let varianteImagen = '';
    let variantePrecio = 0;
    let varianteSku = '';

    // varianteSeleccionada puede ser string o objeto
    if (varianteSeleccionada && typeof varianteSeleccionada === 'object') {
        varianteObj = varianteSeleccionada;
        claveVar = String(varianteObj.id || varianteObj.nombre || '').trim();
        varianteNombre = String(varianteObj.nombre || claveVar).trim();
        varianteImagen = String(varianteObj.imagen || '').trim();
        variantePrecio = Number(varianteObj.precio) || 0;
        varianteSku = String(varianteObj.sku || '').trim();
    } else {
        claveVar = (varianteSeleccionada || '').trim();
        varianteNombre = claveVar;
    }

    // Verificar stock suficiente antes de agregar
    // Si el producto tiene variantes, NO usar el stock del producto principal
    const tieneVariantes = normalizarVariantes(producto.variantes || []).length > 0;
    let stockDisponible = 0;
    
    if (claveVar) {
        // Si hay variante seleccionada, usar su stock
        const varStockObj = obtenerVariantePorId(producto, claveVar);
        if (varStockObj && (varStockObj.stock === 0 || varStockObj.stock)) {
            stockDisponible = Number(varStockObj.stock) || 0;
        }
    } else if (!tieneVariantes) {
        // Solo usar stock del producto principal si NO tiene variantes
        stockDisponible = Number(producto.stock) || 0;
    }
    const unidadesPorPack = producto.packCantidad || 0;
    const unidadesNecesarias = tipo === 'unidad'
        ? cantidad
        : cantidad * unidadesPorPack;

    // Sumar lo que ya hay en carrito de ese mismo ítem
    const itemExistente = carrito.find(i =>
        i.idProducto === idProducto &&
        i.tipo === tipo &&
        (i.variante || '') === claveVar
    );
    let yaEnCarrito = 0;
    if (itemExistente) {
        yaEnCarrito = itemExistente.cantidad * (tipo === 'unidad' ? 1 : unidadesPorPack);
    }
    if (stockDisponible === 0) {
        alert('❌ Este producto no tiene stock disponible.');
        return false;
    }
    
    if (unidadesNecesarias + yaEnCarrito > stockDisponible) {
        const mensaje = stockDisponible === 1 
            ? `⚠️ Solo queda 1 unidad disponible.`
            : `⚠️ Stock insuficiente. Solo hay ${stockDisponible} unidades disponibles.`;
        alert(mensaje);
        return false;
    }

    const precioBase = Number(producto.precioVenta) || 0;
    const precioPromo = producto.promoActiva && producto.precioPromo ? Number(producto.precioPromo) : precioBase;
    let precioUnidad = (tipo === 'unidad') ? precioPromo : (Number(producto.packPrecio) || 0);

    // Si es unidad y la variante tiene precio propio, úsalo SOLO si NO hay promoción activa
    // Si hay promoción activa, el precio promocional se aplica a todas las variantes
    if (tipo === 'unidad' && variantePrecio > 0 && !producto.promoActiva) {
        precioUnidad = variantePrecio;
    }

    const idx = carrito.findIndex(i =>
        i.idProducto === idProducto && i.tipo === tipo && (i.variante || '') === claveVar
    );

    if (idx >= 0) {
        carrito[idx].cantidad += cantidad;
    } else {
        carrito.push({
            idProducto,
            nombre: producto.nombre,
            tipo,
            cantidad,
            precioUnitario: precioUnidad,
            packCantidad: producto.packCantidad || 0,
            variante: claveVar,
            varianteNombre: varianteNombre,
            varianteImagen: varianteImagen || getImagenParaCarrito(producto, varianteObj),
            varianteSku: varianteSku || '',
            // Para stock por variante (si existe):
            varianteStock: (varianteObj && (varianteObj.stock === 0 || varianteObj.stock)) ? Number(varianteObj.stock) : null
        });
    }
    guardarCarrito();
    renderCarrito();
    
    return true; // Retornar true para indicar que se agregó exitosamente

    // Pequeña animación para indicar que se agregó al carrito (web + móvil)
    try {
        const fabCarrito = document.getElementById('fabCarrito');
        if (fabCarrito) {
            fabCarrito.classList.remove('carrito-badge-anim');
            // forzar reflow para reiniciar la animación
            // eslint-disable-next-line no-unused-expressions
            void fabCarrito.offsetWidth;
            fabCarrito.classList.add('carrito-badge-anim');
        }

        // Toast flotante corto
        const toast = document.createElement('div');
        toast.className = 'toast-carrito';
        toast.textContent = 'Producto agregado al carrito';
        document.body.appendChild(toast);
        setTimeout(() => {
            if (toast && toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 1900);
    } catch (e) {
        console.warn('Error en animación de carrito:', e);
    }
}

function actualizarCantidadCarrito(idProducto, tipo, variante, nuevaCantidad) {
    const item = carrito.find(i =>
        i.idProducto === idProducto && i.tipo === tipo && (i.variante || '') === (variante || '')
    );
    if (!item) return;
    const cant = Number(nuevaCantidad) || 0;
    if (cant <= 0) {
        carrito = carrito.filter(i =>
            !(i.idProducto === idProducto && i.tipo === tipo && (i.variante || '') === (variante || ''))
        );
    } else {
        item.cantidad = cant;
    }
    guardarCarrito();
    renderCarrito();
}

function eliminarDelCarrito(idProducto, tipo, variante) {
    carrito = carrito.filter(i =>
        !(i.idProducto === idProducto && i.tipo === tipo && (i.variante || '') === (variante || ''))
    );
    guardarCarrito();
    renderCarrito();
}

function vaciarCarrito() {
    if (!carrito.length) return;
    if (!confirm('¿Seguro que deseas vaciar completamente el carrito?')) return;
    carrito = [];
    guardarCarrito();
    renderCarrito();
}

function renderCarrito() {
    const lista = document.getElementById('carritoLista');
    const mensajeVacio = document.getElementById('carritoVacioMensaje');
    const totalEl = document.getElementById('carritoTotal');
    const btnVaciar = document.getElementById('btnVaciarCarrito');
    const btnVentaFisica = document.getElementById('btnVentaFisica');
    const btnWhatsApp = document.getElementById('btnPedidoWhatsApp');

    if (!lista || !mensajeVacio || !totalEl) return;

    lista.innerHTML = '';
    let total = 0;
    let totalItems = 0;

    if (!carrito.length) {
        mensajeVacio.style.display = 'block';
        if (btnVaciar) btnVaciar.disabled = true;
        if (btnVentaFisica) btnVentaFisica.disabled = true;
        if (btnWhatsApp) btnWhatsApp.disabled = true;
        totalEl.textContent = 'Total: $0';
        // Actualizar contador del carrito flotante también cuando está vacío
        const fabCountEmpty = document.getElementById('fabCarritoCount');
        if (fabCountEmpty) {
            fabCountEmpty.textContent = '0';
        }
        return;
    } else {
        mensajeVacio.style.display = 'none';
        if (btnVaciar) btnVaciar.disabled = false;
        if (btnVentaFisica) btnVentaFisica.disabled = false;
        if (btnWhatsApp) btnWhatsApp.disabled = false;
    }

    carrito.forEach(item => {
        const fila = document.createElement('div');
        fila.className = 'carrito-item';

        // Imagen (variante o principal)
        const img = document.createElement('img');
        img.className = 'carrito-item-img';
        img.alt = item.nombre || 'Producto';
        img.src = item.varianteImagen || 'https://via.placeholder.com/400x400?text=Producto';

        let nombreMostrar = item.nombre;
        const vtxt = item.varianteNombre || item.variante;
        if (vtxt) nombreMostrar += ` (${vtxt})`;

        const nombre = document.createElement('div');
        nombre.className = 'carrito-item-nombre';
        nombre.innerHTML =
            nombreMostrar +
            '<div class="carrito-item-tipo">' +
            (item.tipo === 'unidad' ? 'Unidad' : `Pack x${item.packCantidad}`) +
            '</div>';

        const precio = document.createElement('div');
        precio.className = 'carrito-item-precio';
        precio.textContent = formatoPrecio(item.precioUnitario);

        const cant = document.createElement('div');
        cant.className = 'carrito-item-cantidad';
        const inputCant = document.createElement('input');
        inputCant.type = 'number';
        inputCant.min = '1';
        inputCant.step = '1';
        inputCant.value = item.cantidad;
        inputCant.addEventListener('change', () => {
            actualizarCantidadCarrito(item.idProducto, item.tipo, item.variante, inputCant.value);
        });
        cant.appendChild(inputCant);

        const sub = document.createElement('div');
        sub.className = 'carrito-item-subtotal';
        const subtotal = item.precioUnitario * item.cantidad;
        total += subtotal;
        totalItems += item.cantidad;
        sub.textContent = formatoPrecio(subtotal);

        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'btn btn-danger btn-sm';
        btnEliminar.textContent = '✖';
        btnEliminar.title = 'Eliminar';
        btnEliminar.style.marginLeft = '4px';
        btnEliminar.addEventListener('click', () => {
            eliminarDelCarrito(item.idProducto, item.tipo, item.variante);
        });

        sub.appendChild(document.createTextNode(' '));
        sub.appendChild(btnEliminar);

        fila.appendChild(img);
        fila.appendChild(nombre);
        fila.appendChild(precio);
        fila.appendChild(cant);
        fila.appendChild(sub);

        lista.appendChild(fila);
    });

    totalEl.textContent = 'Total: ' + formatoPrecio(total);

    // Actualizar el badge del carrito flotante (web + móvil)
    const fabCount = document.getElementById('fabCarritoCount');
    if (fabCount) {
        fabCount.textContent = String(totalItems);
    }

    // También actualizar, si existe, el modal de carrito
    renderCarritoModal();
}

// Render simple del carrito dentro del modal flotante
function renderCarritoModal() {
    const modal = document.getElementById('modalCarrito');
    if (!modal) return;

    const lista = document.getElementById('carritoListaModal');
    const mensajeVacio = document.getElementById('carritoVacioMensajeModal');
    const totalEl = document.getElementById('carritoTotalModal');
    if (!lista || !mensajeVacio || !totalEl) return;

    lista.innerHTML = '';
    let total = 0;

    if (!carrito.length) {
        mensajeVacio.style.display = 'block';
        totalEl.textContent = 'Total: $0';
        return;
    } else {
        mensajeVacio.style.display = 'none';
    }

    carrito.forEach(item => {
        const fila = document.createElement('div');
        fila.className = 'modal-carrito-item';

        // Imagen
        const img = document.createElement('img');
        img.className = 'modal-carrito-item-img';
        img.alt = item.nombre || 'Producto';
        img.src = item.varianteImagen || 'https://via.placeholder.com/400x400?text=Producto';

        // Info principal
        let nombreMostrar = item.nombre;
        const vtxt = item.varianteNombre || item.variante;
        if (vtxt) nombreMostrar += ` (${vtxt})`;

        const info = document.createElement('div');
        info.className = 'modal-carrito-item-info';

        const nombreEl = document.createElement('div');
        nombreEl.className = 'modal-carrito-item-nombre';
        nombreEl.textContent = nombreMostrar;

        const detalleEl = document.createElement('div');
        detalleEl.className = 'modal-carrito-item-detalle';
        const tipoTexto = item.tipo === 'unidad'
            ? 'Unidad'
            : `Pack x${item.packCantidad || 0}`;
        detalleEl.textContent = `${tipoTexto} • ${item.cantidad} x ${formatoPrecio(item.precioUnitario)}`;

        info.appendChild(nombreEl);
        info.appendChild(detalleEl);

        // Subtotal
        const sub = document.createElement('div');
        sub.className = 'modal-carrito-item-sub';
        const subtotal = item.precioUnitario * item.cantidad;
        total += subtotal;
        sub.textContent = formatoPrecio(subtotal);

        fila.appendChild(img);
        fila.appendChild(info);
        fila.appendChild(sub);
        lista.appendChild(fila);
    });

    totalEl.textContent = 'Total: ' + formatoPrecio(total);
}

function abrirModalCarrito() {
    const modal = document.getElementById('modalCarrito');
    if (!modal) return;
    modal.style.display = 'flex';
    renderCarritoModal();
}

function cerrarModalCarrito() {
    const modal = document.getElementById('modalCarrito');
    if (!modal) return;
    modal.style.display = 'none';
}

/* ============================================================
   VENTA FÍSICA
============================================================ */
function registrarVentaFisica() {
    if (!carrito.length) return;

    for (const item of carrito) {
        const p = productos.find(prod => prod.id === item.idProducto);
        if (!p) {
            alert('Un producto del carrito ya no existe en el inventario: ' + item.nombre);
            return;
        }
        // Si el producto tiene variantes, NO usar el stock del producto principal
        const tieneVariantes = normalizarVariantes(p.variantes || []).length > 0;
        let stockActual = 0;
        
        if (item.variante) {
            // Si hay variante, usar su stock
            const varObj = obtenerVariantePorId(p, item.variante);
            if (varObj && (varObj.stock === 0 || varObj.stock)) {
                stockActual = Number(varObj.stock) || 0;
            }
        } else if (!tieneVariantes) {
            // Solo usar stock del producto principal si NO tiene variantes
            stockActual = Number(p.stock) || 0;
        }
        const unidadesNecesarias =
            item.tipo === 'unidad'
                ? item.cantidad
                : item.cantidad * (p.packCantidad || 0);

        if (unidadesNecesarias > stockActual) {
            alert(
                `No hay suficiente stock de "${p.nombre}".\n` +
                `Necesitas ${unidadesNecesarias} unidades y solo hay ${stockActual}.`
            );
            return;
        }
    }

    if (!confirm('¿Registrar esta venta física y descontar el stock?')) return;

    // Calcular total venta y construir items para historial
    let totalVenta = 0;
    const itemsVenta = carrito.map(item => {
        const subtotal = item.precioUnitario * item.cantidad;
        totalVenta += subtotal;
        return {
            idProducto: item.idProducto,
            nombre: item.nombre,
            tipo: item.tipo,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal,
            variante: item.variante || '',
            varianteNombre: item.varianteNombre || ''
        };
    });

    // Registrar en historial de ventas
    const venta = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        tipo: 'fisica',
        total: totalVenta,
        items: itemsVenta
    };
    
    // Verificar que todos los items se guardaron correctamente
    console.log(`✅ Venta registrada con ${itemsVenta.length} productos:`, itemsVenta.map(i => `${i.cantidad}x ${i.nombre}`).join(', '));
    
    ventas.push(venta);
    guardarVentas();
    // Mostrar opciones de ticket (opcional)
    mostrarOpcionesTicket(venta);

    carrito.forEach(item => {
        const p = productos.find(prod => prod.id === item.idProducto);
        if (!p) return;
        const unidadesRestar =
            item.tipo === 'unidad'
                ? item.cantidad
                : item.cantidad * (p.packCantidad || 0);

        const tieneVariantes = normalizarVariantes(p.variantes || []).length > 0;
        
        if (item.variante) {
            // Si hay variante, descontar de la variante
            const vars = normalizarVariantes(p.variantes || []);
            const idxv = vars.findIndex(v => String(v.id) === String(item.variante));
            if (idxv >= 0 && (vars[idxv].stock === 0 || vars[idxv].stock)) {
                vars[idxv].stock = (Number(vars[idxv].stock) || 0) - unidadesRestar;
                p.variantes = vars; // guardar de vuelta
            }
        } else if (!tieneVariantes) {
            // Solo descontar del producto principal si NO tiene variantes
            p.stock = (Number(p.stock) || 0) - unidadesRestar;
        }
        p.ventas = (Number(p.ventas) || 0) + item.cantidad;
    });

    guardarProductos();
    carrito = [];
    guardarCarrito();
    renderFiltrosCategoria();
    renderListaProductosTienda();
    renderCarrito();
    renderInventarioTabla();
    actualizarDashboard();
    alert('Venta registrada y stock actualizado.');
}

/* ============================================================
   PEDIDO POR WHATSAPP
============================================================ */
function generarTextoWhatsApp() {
    if (!carrito.length) return '';

    let mensaje = 'Hola, quiero hacer el siguiente pedido en Tabloncito Digital:%0A%0A';
    let total = 0;

    carrito.forEach((item, index) => {
        const subtotal = item.precioUnitario * item.cantidad;
        total += subtotal;
        const tipoTexto =
            item.tipo === 'unidad' ? 'Unidades' : `Packs x${item.packCantidad}`;
        const varTxt = (item.varianteNombre || item.variante) ? ` (${item.varianteNombre || item.variante})` : '';
        mensaje +=
            `${index + 1}. ${item.nombre}${varTxt} - ${tipoTexto}: ${item.cantidad} - ${formatoPrecio(subtotal)}%0A`;
    });

    mensaje += `%0ATotal: ${formatoPrecio(total)}%0A`;
    mensaje += `%0AForma de entrega: (domicilio / recoger en tienda)%0A`;
    mensaje += 'Observaciones: ';

    return mensaje;
}

function enviarPedidoWhatsApp() {
    if (!carrito.length) return;
    const texto = generarTextoWhatsApp();
    if (!texto) return;
    const numero = '573016520610';
    const url = 'https://wa.me/' + numero + '?text=' + texto;

    // Registrar pedido en historial (no descuenta stock)
    let totalPedido = 0;
    const itemsPedido = carrito.map(item => {
        const subtotal = item.precioUnitario * item.cantidad;
        totalPedido += subtotal;
        return {
            idProducto: item.idProducto,
            nombre: item.nombre,
            tipo: item.tipo,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal,
            variante: item.variante || '',
            varianteNombre: item.varianteNombre || ''
        };
    });
    const pedido = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        tipo: 'pedido_whatsapp',
        total: totalPedido,
        items: itemsPedido
    };
    ventas.push(pedido);
    guardarVentas();

    window.open(url, '_blank');
    // Mostrar opciones de ticket (opcional)
    mostrarOpcionesTicket(pedido);
}

/* ============================================================
   ADMIN - FORMULARIO PRODUCTO
============================================================ */
/*
 Estructura producto:

 {
   id, nombre, descripcion,
   costo, precioVenta, precioAnterior,
   packCantidad, packPrecio,
   stock, categoria, sku,
   imagenPrincipal, imagenesExtra (array),
   variantes (array de strings),
   promoActiva (bool),
   precioPromo (number),
   promoTexto (string),
   etiquetaVerde (string),
   ventas (number)
 }
*/

function limpiarFormularioProducto() {
    const id = document.getElementById('productoId');
    if (!id) return;
    id.value = '';
    [
        'nombreProducto','descripcionProducto','costoProducto','precioProducto',
        'precioAnteriorProducto','packCantidadProducto','packPrecioProducto',
        'stockProducto','categoriaProducto','skuProducto',
        'imagenPrincipalProducto','imagenesExtraProducto',
        'variantesProducto','promoTextoProducto','precioPromoProducto','etiquetaVerdeProducto'
    ].forEach(idField => {
        const el = document.getElementById(idField);
        if (el) el.value = '';
    });
    const ve = document.getElementById('variantesEditor');
    if (ve) ve.innerHTML = '';
    const chkPromo = document.getElementById('promoActivaProducto');
    if (chkPromo) chkPromo.checked = false;
    document.getElementById('btnGuardarProducto').textContent = '💾 Guardar producto';
    const imgFile = document.getElementById('imagenArchivoProducto');
    if (imgFile) imgFile.value = '';
}

function guardarProductoDesdeFormulario(event) {
    event.preventDefault();
    const idInput = document.getElementById('productoId');
    if (!idInput) {
        console.error('No se encontró el input productoId');
        return;
    }

    // Leer y normalizar el ID
    const id = idInput.value ? String(idInput.value).trim() : '';
    const nombre = document.getElementById('nombreProducto').value.trim();
    const descripcion = document.getElementById('descripcionProducto').value.trim();
    const costo = Number(document.getElementById('costoProducto').value);
    const precioVenta = Number(document.getElementById('precioProducto').value);
    const precioAnterior = Number(document.getElementById('precioAnteriorProducto').value) || 0;
    const packCantidad =
        Number(document.getElementById('packCantidadProducto').value) || 0;
    const packPrecio =
        Number(document.getElementById('packPrecioProducto').value) || 0;
    const stock = Number(document.getElementById('stockProducto').value);
    const categoria = document.getElementById('categoriaProducto').value.trim();
    const sku = document.getElementById('skuProducto').value.trim();
    const imagenPrincipal = document.getElementById('imagenPrincipalProducto').value.trim();
    const imagenesExtraTexto = document.getElementById('imagenesExtraProducto').value.trim();
    // Si hay editor visual, sincroniza a textarea ANTES de leerla
    if (document.getElementById('variantesEditor')) {
        syncVariantesEditorToTextarea();
    }
    const variantesElemento = document.getElementById('variantesProducto');
    const variantesTexto = variantesElemento ? variantesElemento.value.trim() : '';
    const promoActiva = document.getElementById('promoActivaProducto').checked;
    const promoTexto = document.getElementById('promoTextoProducto').value.trim();
    const precioPromo = Number(document.getElementById('precioPromoProducto').value) || 0;
    const etiquetaVerde = document.getElementById('etiquetaVerdeProducto').value.trim();

    if (!nombre || !precioVenta || stock < 0 || costo < 0) {
        alert('Revisa nombre, costo, precio de venta y stock.');
        return;
    }

    if ((packCantidad > 0 && packPrecio <= 0) || (packPrecio > 0 && packCantidad <= 0)) {
        alert('Si configuras un pack, debes poner cantidad y precio del pack.');
        return;
    }

    if (promoActiva && !precioPromo) {
        alert('Si activas promo, debes indicar el precio promocional.');
        return;
    }

    const imagenesExtra = imagenesExtraTexto
        ? imagenesExtraTexto.split(',').map(s => s.trim()).filter(Boolean)
        : [];
    let variantes = [];
    if (variantesTexto) {
        const t = variantesTexto.trim();
        if (t.startsWith('[')) {
            try {
                const arr = JSON.parse(t);
                variantes = normalizarVariantes(arr);
            } catch (e) {
                alert('Las variantes (JSON) no son válidas. Revisa el formato.');
                return;
            }
        } else {
            variantes = normalizarVariantes(t.split(',').map(s => s.trim()).filter(Boolean));
        }
    }

    // Validar y buscar el producto
    if (id) {
        // Buscar el producto normalizando ambos IDs, usando el array "productos"
        // ya cargado desde IndexedDB al inicio (evitamos recargar desde localStorage,
        // que puede tener datos desactualizados).
        const searchId = String(id).trim();
        const p = productos.find(prod => {
            const prodId = String(prod.id).trim();
            return prodId === searchId;
        });
        
        if (!p) {
            console.error('Producto no encontrado. ID buscado:', searchId, 'Tipo:', typeof id, 'IDs disponibles:', productos.map(pr => ({ id: String(pr.id).trim(), tipo: typeof pr.id })));
            alert('Error: el producto ya no existe. Por favor, recarga la página e intenta de nuevo.');
            limpiarFormularioProducto();
            return;
        }
        Object.assign(p, {
            nombre,
            descripcion,
            costo,
            precioVenta,
            precioAnterior,
            packCantidad,
            packPrecio,
            stock,
            categoria,
            sku,
            imagenPrincipal,
            imagenesExtra,
            variantes,
            promoActiva,
            promoTexto,
            precioPromo,
            etiquetaVerde
        });
    } else {
        const nuevo = {
            id: Date.now(),
            nombre,
            descripcion,
            costo,
            precioVenta,
            precioAnterior,
            packCantidad,
            packPrecio,
            stock,
            categoria,
            sku,
            imagenPrincipal,
            imagenesExtra,
            variantes,
            promoActiva,
            promoTexto,
            precioPromo,
            etiquetaVerde,
            ventas: 0
        };
        productos.push(nuevo);
    }

    // Guardar productos y actualizar en GitHub
    guardarProductos(true);
    limpiarFormularioProducto();
    renderFiltrosCategoria();
    renderDatalistCategoriasAdmin();
    renderListaProductosTienda();
    renderInventarioTabla();
    actualizarDashboard();
}

/* ============================================================
   ADMIN - BUSCAR POR CÓDIGO (LECTOR DE BARRAS)
============================================================ */
function buscarProductoPorCodigo(codigo) {
    if (!codigo) return;
    const cod = codigo.toLowerCase();
    // Primero buscar por SKU de producto
    let encontrado = productos.find(p => (p.sku || '').toLowerCase() === cod);
    if (encontrado) {
        cargarProductoEnFormulario(encontrado.id);
        return;
    }
    // Luego intentar encontrar por SKU de variante
    for (const p of productos) {
        const vars = normalizarVariantes(p.variantes || []);
        const v = vars.find(vv => (vv.sku || '').toLowerCase() === cod);
        if (v) {
            cargarProductoEnFormulario(p.id);
            alert('Se encontró la variante: ' + v.nombre + ' del producto: ' + (p.nombre || ''));
            return;
        }
    }
    alert("No se encontró ningún producto o variante con código: " + codigo);
}

/* ============================================================
   ADMIN - EDITAR / ELIMINAR / TABLA
============================================================ */
function cargarProductoEnFormulario(idProducto) {
    // Normalizar el ID para comparación consistente (puede ser número o string)
    const idBuscado = String(idProducto).trim();
    const p = productos.find(prod => String(prod.id).trim() === idBuscado);
    if (!p) {
        console.warn('Producto no encontrado con ID:', idProducto, 'IDs disponibles:', productos.map(pr => String(pr.id).trim()));
        alert('Error: No se pudo cargar el producto. Por favor, recarga la página.');
        return;
    }
    // Asegurar que el ID se guarde como string en el input para consistencia
    const idInput = document.getElementById('productoId');
    if (idInput) {
        idInput.value = String(p.id);
        // Verificar que se guardó correctamente
        if (String(idInput.value).trim() !== String(p.id).trim()) {
            console.error('Error: El ID no se guardó correctamente en el input');
            idInput.value = String(p.id); // Intentar de nuevo
        }
    } else {
        console.error('No se encontró el input productoId');
        return;
    }
    document.getElementById('nombreProducto').value = p.nombre || '';
    document.getElementById('descripcionProducto').value = p.descripcion || '';
    document.getElementById('costoProducto').value = p.costo || '';
    document.getElementById('precioProducto').value = p.precioVenta || '';
    document.getElementById('precioAnteriorProducto').value = p.precioAnterior || '';
    document.getElementById('packCantidadProducto').value = p.packCantidad || '';
    document.getElementById('packPrecioProducto').value = p.packPrecio || '';
    document.getElementById('stockProducto').value = p.stock || 0;
    document.getElementById('categoriaProducto').value = p.categoria || '';
    document.getElementById('skuProducto').value = p.sku || '';
    document.getElementById('imagenPrincipalProducto').value = p.imagenPrincipal || '';
    document.getElementById('imagenesExtraProducto').value = (p.imagenesExtra || []).join(', ');
    document.getElementById('variantesProducto').value = (p.variantes && p.variantes.length && typeof p.variantes[0] === 'object') ? JSON.stringify(normalizarVariantes(p.variantes)) : (p.variantes || []).join(', ');
    if (document.getElementById('variantesEditor')) { pintarEditorVariantes(p.variantes || []); }
    document.getElementById('promoActivaProducto').checked = !!p.promoActiva;
    document.getElementById('promoTextoProducto').value = p.promoTexto || '';
    document.getElementById('precioPromoProducto').value = p.precioPromo || '';
    document.getElementById('etiquetaVerdeProducto').value = p.etiquetaVerde || '';
    document.getElementById('btnGuardarProducto').textContent = '✅ Actualizar producto';
}

function eliminarProducto(idProducto) {
    if (!confirm('¿Seguro que deseas eliminar este producto del inventario?')) return;
    const idBuscado = String(idProducto).trim();
    productos = productos.filter(p => String(p.id).trim() !== idBuscado);
    guardarProductos(true); // Actualizar en GitHub (esto ya invalida el caché internamente)
    invalidarCacheProductos(); // Limpiar caché adicional para forzar recarga en otros dispositivos
    carrito = carrito.filter(i => i.idProducto !== idProducto);
    guardarCarrito();
    renderFiltrosCategoria();
    renderListaProductosTienda();
    renderInventarioTabla();
    actualizarDashboard();
}

function renderInventarioTabla() {
    const tbody = document.getElementById('tablaInventario');
    const mensajeVacio = document.getElementById('inventarioVacio');
    const inputFiltroNombre = document.getElementById('buscarNombreInventario');
    if (!tbody || !mensajeVacio) return;

    tbody.innerHTML = '';

    // Filtrar por nombre si hay texto en el buscador
    let lista = [...productos];
    if (inputFiltroNombre && inputFiltroNombre.value.trim()) {
        const q = inputFiltroNombre.value.trim().toLowerCase();
        lista = lista.filter(p => (p.nombre || '').toLowerCase().includes(q));
    }

    if (!lista.length) {
        mensajeVacio.style.display = 'block';
    } else {
        mensajeVacio.style.display = 'none';
    }

    lista.forEach(p => {
        // Fila principal del producto
        const tr = document.createElement('tr');

        const tdNombre = document.createElement('td');
        tdNombre.textContent = p.nombre || '';

        const tdCat = document.createElement('td');
        tdCat.textContent = p.categoria || '';

        const tdCosto = document.createElement('td');
        tdCosto.className = 'text-right';
        tdCosto.textContent = formatoPrecio(p.costo || 0);

        const tdVenta = document.createElement('td');
        tdVenta.className = 'text-right';
        tdVenta.textContent = formatoPrecio(p.precioVenta || 0);

        const tdPack = document.createElement('td');
        tdPack.className = 'text-right';
        if (p.packCantidad && p.packCantidad > 0 && p.packPrecio && p.packPrecio > 0) {
            tdPack.textContent = `x${p.packCantidad}: ${formatoPrecio(p.packPrecio)}`;
        } else {
            tdPack.textContent = '-';
        }

        const tdStock = document.createElement('td');
        tdStock.className = 'text-right';
        tdStock.textContent = Number(p.stock) || 0;

        const tdSku = document.createElement('td');
        tdSku.textContent = p.sku || '';

        const tdAcciones = document.createElement('td');
        tdAcciones.className = 'text-center';

        const btnEditar = document.createElement('button');
        btnEditar.className = 'btn btn-primary btn-sm';
        btnEditar.textContent = '✏️';
        btnEditar.title = 'Editar';
        btnEditar.addEventListener('click', () => cargarProductoEnFormulario(p.id));

        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'btn btn-danger btn-sm';
        btnEliminar.textContent = '🗑️';
        btnEliminar.title = 'Eliminar';
        btnEliminar.style.marginLeft = '4px';
        btnEliminar.addEventListener('click', () => eliminarProducto(p.id));

        tdAcciones.appendChild(btnEditar);
        tdAcciones.appendChild(btnEliminar);

        tr.appendChild(tdNombre);
        tr.appendChild(tdCat);
        tr.appendChild(tdCosto);
        tr.appendChild(tdVenta);
        tr.appendChild(tdPack);
        tr.appendChild(tdStock);
        tr.appendChild(tdSku);
        tr.appendChild(tdAcciones);

        tbody.appendChild(tr);

        // Filas adicionales por variante (si manejan stock propio)
        const vars = normalizarVariantes(p.variantes || []);
        vars.forEach(v => {
            if (!(v.stock === 0 || v.stock)) return; // solo variantes con stock definido
            const trVar = document.createElement('tr');

            const tdNombreVar = document.createElement('td');
            tdNombreVar.textContent = `${p.nombre || ''} (${v.nombre})`;

            const tdCatVar = document.createElement('td');
            tdCatVar.textContent = p.categoria || '';

            const tdCostoVar = document.createElement('td');
            tdCostoVar.className = 'text-right';
            tdCostoVar.textContent = formatoPrecio(p.costo || 0);

            const tdVentaVar = document.createElement('td');
            tdVentaVar.className = 'text-right';
            const precioVar = Number(v.precio) || 0;
            tdVentaVar.textContent = formatoPrecio(precioVar || p.precioVenta || 0);

            const tdPackVar = document.createElement('td');
            tdPackVar.className = 'text-right';
            if (p.packCantidad && p.packCantidad > 0 && p.packPrecio && p.packPrecio > 0) {
                tdPackVar.textContent = `x${p.packCantidad}: ${formatoPrecio(p.packPrecio)}`;
            } else {
                tdPackVar.textContent = '-';
            }

            const tdStockVar = document.createElement('td');
            tdStockVar.className = 'text-right';
            tdStockVar.textContent = Number(v.stock) || 0;

            const tdSkuVar = document.createElement('td');
            tdSkuVar.textContent = p.sku || '';

            const tdAccVar = document.createElement('td');
            tdAccVar.className = 'text-center';
            const spanInfo = document.createElement('span');
            spanInfo.className = 'small text-muted';
            spanInfo.textContent = 'Variante';
            tdAccVar.appendChild(spanInfo);

            trVar.appendChild(tdNombreVar);
            trVar.appendChild(tdCatVar);
            trVar.appendChild(tdCostoVar);
            trVar.appendChild(tdVentaVar);
            trVar.appendChild(tdPackVar);
            trVar.appendChild(tdStockVar);
            trVar.appendChild(tdSkuVar);
            trVar.appendChild(tdAccVar);

            tbody.appendChild(trVar);
        });
    });
}

function actualizarDashboard() {
    const totalProductosEl = document.getElementById('dashTotalProductos');
    const totalUnidadesEl = document.getElementById('dashTotalUnidades');
    const valorCostoEl = document.getElementById('dashValorCosto');
    if (!totalProductosEl || !totalUnidadesEl || !valorCostoEl) return;

    let totalUnidades = 0;
    let totalCosto = 0;

    productos.forEach(p => {
        const stock = Number(p.stock) || 0;
        const costo = Number(p.costo) || 0;
        totalUnidades += stock;
        totalCosto += stock * costo;
    });

    totalProductosEl.textContent = productos.length;
    totalUnidadesEl.textContent = totalUnidades;
    valorCostoEl.textContent = formatoPrecio(totalCosto);
}

/* ============================================================
   ADMIN - HISTORIAL DE VENTAS Y REPORTES
============================================================ */
function ventasFiltradasPorRango(rango, fechaEspecifica = null) {
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    let desde = null;
    let hasta = null;

    if (rango === 'hoy') {
        desde = inicioHoy;
        hasta = new Date(inicioHoy);
        hasta.setHours(23, 59, 59, 999);
    } else if (rango === '7dias') {
        desde = new Date(inicioHoy);
        desde.setDate(desde.getDate() - 6); // hoy + 6 días atrás = 7 días
        hasta = new Date(ahora);
        hasta.setHours(23, 59, 59, 999);
    } else if (rango === 'dia' && fechaEspecifica) {
        // Día específico
        const fecha = new Date(fechaEspecifica);
        desde = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
        hasta = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
        hasta.setHours(23, 59, 59, 999);
    } else if (rango === 'mes' && fechaEspecifica) {
        // Mes específico (formato YYYY-MM)
        const [anio, mes] = fechaEspecifica.split('-').map(Number);
        desde = new Date(anio, mes - 1, 1); // Primer día del mes
        hasta = new Date(anio, mes, 0, 23, 59, 59, 999); // Último día del mes
    } else if (rango === 'anio' && fechaEspecifica) {
        // Año específico
        const anio = Number(fechaEspecifica);
        desde = new Date(anio, 0, 1); // 1 de enero
        hasta = new Date(anio, 11, 31, 23, 59, 59, 999); // 31 de diciembre
    }

    return ventas.filter(v => {
        const fecha = new Date(v.fecha);
        if (Number.isNaN(fecha.getTime())) return false;
        if (!desde) return true; // todo historial
        
        if (hasta) {
            return fecha >= desde && fecha <= hasta;
        }
        return fecha >= desde;
    }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

function renderVentas(rango = 'hoy', fechaEspecifica = null) {
    ventasRangoActual = rango;
    const tbody = document.getElementById('tablaVentas');
    const vacio = document.getElementById('ventasVacio');
    const lblRango = document.getElementById('ventasRangoLabel');
    const lblCantidad = document.getElementById('ventasCantidad');
    const lblTotal = document.getElementById('ventasTotal');
    const lblGanancia = document.getElementById('ventasGanancia');
    if (!tbody || !vacio || !lblRango || !lblCantidad || !lblTotal) return;

    let etiqueta = 'Hoy';
    if (rango === '7dias') etiqueta = 'Últimos 7 días';
    if (rango === 'todo') etiqueta = 'Todo el historial';
    if (rango === 'dia' && fechaEspecifica) {
        const fecha = new Date(fechaEspecifica);
        etiqueta = fecha.toLocaleDateString('es-CO', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        // Capitalizar primera letra
        etiqueta = etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
    }
    if (rango === 'mes' && fechaEspecifica) {
        const [anio, mes] = fechaEspecifica.split('-').map(Number);
        const fecha = new Date(anio, mes - 1, 1);
        etiqueta = fecha.toLocaleDateString('es-CO', { year: 'numeric', month: 'long' });
        etiqueta = etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
    }
    if (rango === 'anio' && fechaEspecifica) {
        etiqueta = `Año ${fechaEspecifica}`;
    }
    lblRango.textContent = etiqueta;

    const lista = ventasFiltradasPorRango(rango, fechaEspecifica);
    tbody.innerHTML = '';

    if (!lista.length) {
        vacio.style.display = 'block';
        lblCantidad.textContent = '0';
        lblTotal.textContent = formatoPrecio(0);
        if (lblGanancia) lblGanancia.textContent = formatoPrecio(0);
        return;
    }
    vacio.style.display = 'none';

    let total = 0;
    let totalCosto = 0;
    lista.forEach(v => {
        // Descomprimir venta si es necesario
        const ventaDescomprimida = v.f || v.fecha ? descomprimirVenta(v) : v;
        const totalVenta = Number(ventaDescomprimida.total || ventaDescomprimida.tot) || 0;
        total += totalVenta;
        
        // Asegurar que items esté descomprimido correctamente
        if (!ventaDescomprimida.esResumen && ventaDescomprimida.items) {
            // Si los items están comprimidos, descomprimirlos
            if (Array.isArray(ventaDescomprimida.items)) {
                ventaDescomprimida.items = ventaDescomprimida.items.map(item => {
                    if (item.i) {
                        // Está comprimido, descomprimir
                        return descomprimirItemVenta(item);
                    }
                    return item;
                });
            }
        }
        
        // Calcular costo total de los productos vendidos
        if (!ventaDescomprimida.esResumen && Array.isArray(ventaDescomprimida.items)) {
            ventaDescomprimida.items.forEach(item => {
                const idProd = item.idProducto || item.i;
                const producto = productos.find(p => p.id === idProd);
                if (producto) {
                    const costoProducto = Number(producto.costo) || 0;
                    const cantidad = Number(item.cantidad || item.c) || 0;
                    const tipo = item.tipo || item.t || 'unidad';
                    
                    // Si es pack, calcular unidades totales
                    let unidades = cantidad;
                    if (tipo === 'pack' && producto.packCantidad) {
                        unidades = cantidad * Number(producto.packCantidad);
                    }
                    
                    totalCosto += costoProducto * unidades;
                }
            });
        }
        const tr = document.createElement('tr');

        const fecha = new Date(ventaDescomprimida.fecha || ventaDescomprimida.f);
        const tdFecha = document.createElement('td');
        tdFecha.textContent = fecha.toLocaleString('es-CO', {
            year: '2-digit', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });

        const tdTipo = document.createElement('td');
        const tipo = ventaDescomprimida.tipo || ventaDescomprimida.t;
        tdTipo.textContent = tipo === 'fisica' ? 'Venta física' : 'Pedido WhatsApp';
        if (ventaDescomprimida.esResumen) {
            tdTipo.textContent += ' (Resumen)';
            tdTipo.style.color = '#999';
        }

        const tdDetalle = document.createElement('td');
        if (ventaDescomprimida.esResumen) {
            tdDetalle.textContent = `Resumen: ${ventaDescomprimida.n || 0} items`;
            tdDetalle.style.color = '#999';
            tdDetalle.style.fontStyle = 'italic';
        } else if (Array.isArray(ventaDescomprimida.items) && ventaDescomprimida.items.length > 0) {
            // Crear lista más visible de todos los productos
            const listaItems = ventaDescomprimida.items.map((i, idx) => {
                const nombre = i.nombre || i.n || 'Producto';
                const varTxt = i.varianteNombre || i.vn || i.variante || i.v || '';
                const cantidad = i.cantidad || i.c || 0;
                const tipo = i.tipo || i.t || 'unidad';
                const tipoTexto = tipo === 'pack' ? 'pack' : 'unidad';
                const base = `${cantidad} ${tipoTexto} x ${nombre}`;
                return varTxt ? `${base} (${varTxt})` : base;
            });
            
            // Si hay muchos items, mostrar en formato lista
            if (listaItems.length > 2) {
                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.flexDirection = 'column';
                div.style.gap = '4px';
                listaItems.forEach((item, idx) => {
                    const span = document.createElement('span');
                    span.textContent = `${idx + 1}. ${item}`;
                    span.style.fontSize = '0.85rem';
                    div.appendChild(span);
                });
                tdDetalle.appendChild(div);
            } else {
                // Si son pocos, mostrar en línea
                tdDetalle.textContent = listaItems.join(' • ');
            }
            
            // Agregar tooltip con todos los items
            tdDetalle.title = listaItems.join('\n');
        } else {
            tdDetalle.textContent = 'Sin detalles';
            tdDetalle.style.color = '#999';
        }

        const tdTotal = document.createElement('td');
        tdTotal.className = 'text-right';
        tdTotal.textContent = formatoPrecio(ventaDescomprimida.total || ventaDescomprimida.tot || 0);

        const tdAcc = document.createElement('td');
        tdAcc.className = 'text-center';

        const btnTicket = document.createElement('button');
        btnTicket.className = 'btn btn-secondary btn-sm';
        btnTicket.textContent = '🖨';
        btnTicket.title = 'Imprimir ticket';
        btnTicket.disabled = ventaDescomprimida.esResumen; // Deshabilitar para resúmenes
        if (!ventaDescomprimida.esResumen) {
            btnTicket.addEventListener('click', () => imprimirTicketVentaPorId(ventaDescomprimida.id));
        }

        const btnEditar = document.createElement('button');
        btnEditar.className = 'btn btn-secondary btn-sm';
        btnEditar.textContent = '✏️';
        btnEditar.title = 'Editar registro';
        btnEditar.disabled = ventaDescomprimida.esResumen; // Deshabilitar para resúmenes
        btnEditar.style.marginLeft = '4px';
        if (!ventaDescomprimida.esResumen) {
            btnEditar.addEventListener('click', () => editarVentaPorId(ventaDescomprimida.id));
        }

        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'btn btn-danger btn-sm';
        btnEliminar.textContent = '🗑️';
        btnEliminar.title = 'Eliminar registro';
        btnEliminar.style.marginLeft = '4px';
        btnEliminar.addEventListener('click', () => eliminarVentaPorId(ventaDescomprimida.id));

        tdAcc.appendChild(btnTicket);
        tdAcc.appendChild(btnEditar);
        tdAcc.appendChild(btnEliminar);

        tr.appendChild(tdFecha);
        tr.appendChild(tdTipo);
        tr.appendChild(tdDetalle);
        tr.appendChild(tdTotal);
        tr.appendChild(tdAcc);
        tbody.appendChild(tr);
    });

    lblCantidad.textContent = String(lista.length);
    lblTotal.textContent = formatoPrecio(total);
    const ganancia = total - totalCosto;
    if (lblGanancia) lblGanancia.textContent = formatoPrecio(ganancia);
}

function borrarTodasLasVentas() {
    if (!ventas.length) {
        alert('No hay registros de ventas para borrar.');
        return;
    }
    if (!confirm('Esto borrará TODO el historial de ventas. Se restaurará el stock de todas las ventas físicas y se resetearán los contadores de ventas. ¿Seguro que deseas continuar?')) return;
    
    // Restaurar stock de todas las ventas físicas
    ventas.forEach(venta => {
        if (venta.tipo === 'fisica' && Array.isArray(venta.items)) {
            venta.items.forEach(item => {
                const p = productos.find(prod => prod.id === item.idProducto);
                if (!p) return;
                
                const unidadesRestaurar = item.tipo === 'unidad'
                    ? item.cantidad
                    : item.cantidad * (item.packCantidad || p.packCantidad || 0);
                
                const tieneVariantes = normalizarVariantes(p.variantes || []).length > 0;
                
                if (item.variante) {
                    const vars = normalizarVariantes(p.variantes || []);
                    const idxv = vars.findIndex(v => String(v.id) === String(item.variante));
                    if (idxv >= 0 && (vars[idxv].stock === 0 || vars[idxv].stock)) {
                        vars[idxv].stock = (Number(vars[idxv].stock) || 0) + unidadesRestaurar;
                        p.variantes = vars;
                    }
                } else if (!tieneVariantes) {
                    // Solo restaurar stock del producto principal si NO tiene variantes
                    p.stock = (Number(p.stock) || 0) + unidadesRestaurar;
                }
            });
        }
    });
    
    // Resetear contador de ventas de todos los productos a 0
    productos.forEach(p => {
        p.ventas = 0;
    });
    
    ventas = [];
    guardarVentas();
    guardarProductos();
    
    // Forzar actualización de todas las vistas
    renderVentas(ventasRangoActual || 'hoy');
    renderInventarioTabla();
    renderListaProductosTienda();
    
    // Si estamos en la página de detalle del producto, también actualizar esa vista
    if (typeof renderProductoDetalle === 'function') {
        const productoId = obtenerParametroURL('id');
        if (productoId) {
            renderProductoDetalle();
        }
    }
    
    actualizarDashboard();
    alert('Historial de ventas borrado, stock restaurado y contadores de ventas reseteados a 0.');
}

function exportarVentasJSON() {
    if (!ventas.length) {
        alert('No hay ventas para exportar.');
        return;
    }
    const json = JSON.stringify(ventas, null, 2);
    // Crear descarga directa
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fecha = new Date();
    a.download = `ventas_tabloncito_${fecha.getFullYear()}-${(fecha.getMonth()+1)
        .toString().padStart(2,'0')}-${fecha.getDate().toString().padStart(2,'0')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Importar ventas desde archivo JSON de respaldo
function importarVentasDesdeArchivo() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    
    input.addEventListener('change', async (e) => {
        const archivo = e.target.files[0];
        if (!archivo) return;
        
        try {
            const texto = await archivo.text();
            const ventasImportadas = JSON.parse(texto);
            
            if (!Array.isArray(ventasImportadas)) {
                alert('El archivo no contiene un array válido de ventas.');
                return;
            }
            
            if (ventasImportadas.length === 0) {
                alert('El archivo está vacío.');
                return;
            }
            
            // Crear un Set con los IDs de las ventas actuales para evitar duplicados
            const idsExistentes = new Set(ventas.map(v => String(v.id)));
            
            // Filtrar ventas nuevas (que no existen ya)
            const ventasNuevas = ventasImportadas.filter(v => {
                const idVenta = String(v.id || '');
                return idVenta && !idsExistentes.has(idVenta);
            });
            
            if (ventasNuevas.length === 0) {
                alert(`El archivo contiene ${ventasImportadas.length} ventas, pero todas ya están en el historial.`);
                return;
            }
            
            const mensaje = `Se encontraron ${ventasImportadas.length} ventas en el archivo.\n` +
                          `${ventasNuevas.length} son nuevas y se agregarán al historial.\n` +
                          `${ventasImportadas.length - ventasNuevas.length} ya existen y se omitirán.\n\n` +
                          `¿Deseas importar las ${ventasNuevas.length} ventas nuevas?`;
            
            if (!confirm(mensaje)) return;
            
            // Agregar las ventas nuevas al historial
            ventas = ventas.concat(ventasNuevas);
            
            // Ordenar por fecha (más recientes primero)
            ventas.sort((a, b) => {
                const fechaA = a.fecha ? new Date(a.fecha).getTime() : 0;
                const fechaB = b.fecha ? new Date(b.fecha).getTime() : 0;
                return fechaB - fechaA;
            });
            
            // Guardar las ventas actualizadas
            await guardarVentas();
            
            // Actualizar la vista
            renderVentas(ventasRangoActual);
            actualizarDashboard();
            
            alert(`✅ Se importaron ${ventasNuevas.length} ventas exitosamente.\n\nTotal de ventas en el historial: ${ventas.length}`);
            
        } catch (error) {
            console.error('Error al importar ventas:', error);
            alert('Error al importar el archivo: ' + error.message + '\n\nAsegúrate de que el archivo sea un JSON válido exportado desde esta aplicación.');
        } finally {
            document.body.removeChild(input);
        }
    });
    
    document.body.appendChild(input);
    input.click();
}

// Recuperar ventas perdidas basándose en los contadores de productos
async function recuperarVentasPerdidas() {
    if (!productos || productos.length === 0) {
        alert('No hay productos para analizar.');
        return;
    }
    
    // Calcular cuántas ventas hay realmente en el historial por producto
    const ventasPorProducto = new Map();
    
    ventas.forEach(venta => {
        if (venta.items && Array.isArray(venta.items)) {
            venta.items.forEach(item => {
                const idProd = String(item.idProducto || '');
                if (!idProd) return;
                
                const cantidad = Number(item.cantidad) || 0;
                const actual = ventasPorProducto.get(idProd) || 0;
                ventasPorProducto.set(idProd, actual + cantidad);
            });
        }
    });
    
    // Encontrar productos con ventas en contador pero sin ventas en historial
    const productosConVentasPerdidas = [];
    
    productos.forEach(producto => {
        const ventasContador = Number(producto.ventas) || 0;
        if (ventasContador <= 0) return;
        
        const ventasEnHistorial = ventasPorProducto.get(String(producto.id)) || 0;
        const ventasPerdidas = ventasContador - ventasEnHistorial;
        
        if (ventasPerdidas > 0) {
            productosConVentasPerdidas.push({
                producto: producto,
                ventasPerdidas: ventasPerdidas,
                ventasEnHistorial: ventasEnHistorial,
                ventasContador: ventasContador
            });
        }
    });
    
    if (productosConVentasPerdidas.length === 0) {
        alert('✅ No se encontraron ventas perdidas.\n\nTodos los contadores de productos coinciden con las ventas en el historial.');
        return;
    }
    
    // Mostrar resumen
    let mensaje = `Se encontraron ${productosConVentasPerdidas.length} productos con ventas perdidas:\n\n`;
    productosConVentasPerdidas.forEach((item, idx) => {
        if (idx < 10) { // Mostrar solo los primeros 10
            mensaje += `• ${item.producto.nombre}: ${item.ventasPerdidas} ventas perdidas (contador: ${item.ventasContador}, historial: ${item.ventasEnHistorial})\n`;
        }
    });
    if (productosConVentasPerdidas.length > 10) {
        mensaje += `\n... y ${productosConVentasPerdidas.length - 10} productos más.\n`;
    }
    
    const totalVentasPerdidas = productosConVentasPerdidas.reduce((sum, item) => sum + item.ventasPerdidas, 0);
    mensaje += `\nTotal de ventas a recuperar: ${totalVentasPerdidas}\n\n`;
    mensaje += `Se crearán ventas históricas estimadas con fechas distribuidas en los últimos 30 días.\n`;
    mensaje += `¿Deseas recuperar estas ventas?`;
    
    if (!confirm(mensaje)) return;
    
    // Generar ventas históricas
    const ventasRecuperadas = [];
    const ahora = new Date();
    const diasAtras = 30;
    let contadorId = Date.now(); // Base para IDs únicos
    
    productosConVentasPerdidas.forEach((item, idxProducto) => {
        const producto = item.producto;
        const cantidadVentas = item.ventasPerdidas;
        
        // Distribuir las ventas en los últimos días
        for (let i = 0; i < cantidadVentas; i++) {
            // Crear fecha aleatoria en los últimos 30 días
            const diasAleatorios = Math.floor(Math.random() * diasAtras);
            const horasAleatorias = Math.floor(Math.random() * 24);
            const minutosAleatorios = Math.floor(Math.random() * 60);
            
            const fechaVenta = new Date(ahora);
            fechaVenta.setDate(fechaVenta.getDate() - diasAleatorios);
            fechaVenta.setHours(horasAleatorias, minutosAleatorios, 0, 0);
            
            // Determinar precio unitario (usar precio promocional si está activo, sino precio normal)
            const precioUnitario = producto.promoActiva && producto.precioPromo 
                ? Number(producto.precioPromo) 
                : Number(producto.precioVenta) || 0;
            
            // Generar ID único basado en la fecha de la venta y un contador
            const idVenta = fechaVenta.getTime() + contadorId + i;
            
            // Crear venta recuperada con formato estándar
            const ventaRecuperada = {
                id: idVenta,
                fecha: fechaVenta.toISOString(),
                tipo: 'fisica',
                total: precioUnitario,
                items: [{
                    idProducto: producto.id,
                    nombre: producto.nombre,
                    tipo: 'unidad',
                    cantidad: 1,
                    precioUnitario: precioUnitario,
                    subtotal: precioUnitario,
                    variante: '',
                    varianteNombre: ''
                }],
                recuperada: true // Marcar como recuperada
            };
            
            ventasRecuperadas.push(ventaRecuperada);
            contadorId += 1000; // Incrementar para asegurar IDs únicos
        }
    });
    
    // Verificar que no haya IDs duplicados con ventas existentes
    const idsExistentes = new Set(ventas.map(v => String(v.id)));
    const ventasSinDuplicados = ventasRecuperadas.filter(v => {
        const idStr = String(v.id);
        if (idsExistentes.has(idStr)) {
            // Si hay duplicado, generar nuevo ID
            v.id = Date.now() + Math.random();
            return true;
        }
        idsExistentes.add(idStr);
        return true;
    });
    
    // Agregar las ventas recuperadas al historial
    ventas = ventas.concat(ventasSinDuplicados);
    
    // Ordenar por fecha (más recientes primero)
    ventas.sort((a, b) => {
        const fechaA = a.fecha ? new Date(a.fecha).getTime() : 0;
        const fechaB = b.fecha ? new Date(b.fecha).getTime() : 0;
        return fechaB - fechaA;
    });
    
    // Guardar las ventas actualizadas - asegurar que se guarde en ambos lugares
    await guardarVentas();
    
    // También guardar directamente en localStorage como respaldo adicional
    try {
        localStorage.setItem(STORAGE_KEYS.ventas, JSON.stringify(ventas));
        console.log('✅ Ventas recuperadas guardadas también en localStorage');
    } catch (e) {
        console.warn('No se pudo guardar en localStorage:', e);
    }
    
    // Actualizar la vista
    renderVentas(ventasRangoActual);
    actualizarDashboard();
    
    alert(`✅ Se recuperaron ${ventasRecuperadas.length} ventas perdidas exitosamente.\n\nTotal de ventas en el historial: ${ventas.length}\n\nNota: Las ventas recuperadas tienen fechas estimadas distribuidas en los últimos 30 días.`);
}

/* ============================================================
   GESTIÓN DE CRÉDITOS
============================================================ */

async function guardarCreditos() {
    try {
        // Asegurar que todas las créditos tengan ID válido
        const creditosConId = creditos.map(credito => {
            if (!credito.id || credito.id === null || credito.id === undefined) {
                return {
                    ...credito,
                    id: Date.now() + Math.random()
                };
            }
            return credito;
        });
        
        // Convertir créditos a objetos con id como key para IndexedDB
        const creditosObjetos = creditosConId.map(credito => ({
            id: credito.id,
            ...credito
        }));
        
        // Guardar en IndexedDB
        await guardarEnIndexedDB(STORES.creditos, creditosObjetos);
        console.log(`✅ ${creditosObjetos.length} créditos guardados en IndexedDB`);
        
        // También guardar en localStorage como respaldo
        try {
            localStorage.setItem(STORAGE_KEYS.creditos, JSON.stringify(creditosConId));
            console.log('✅ Créditos guardados también en localStorage');
        } catch (e) {
            console.warn('No se pudo guardar créditos en localStorage:', e);
        }
        
    } catch (error) {
        console.error('Error al guardar créditos en IndexedDB:', error);
        // Fallback a localStorage si IndexedDB falla
        try {
            localStorage.setItem(STORAGE_KEYS.creditos, JSON.stringify(creditos));
            console.log('⚠️ Créditos guardados en localStorage (fallback)');
        } catch (e) {
            console.error('Error crítico al guardar créditos:', e);
        }
    }
    
    // Guardar automáticamente en archivo para respaldo
    await guardarCreditosEnArchivo();
}

// Guardar créditos automáticamente en archivo (respaldo seguro)
async function guardarCreditosEnArchivo() {
    try {
        if (!creditos || creditos.length === 0) {
            console.log('No hay créditos para guardar en archivo');
            return;
        }
        
        const json = JSON.stringify(creditos, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        
        // Intentar usar File System Access API si está disponible y hay un handle guardado
        if ('showSaveFilePicker' in window && creditosFileHandle) {
            try {
                // Escribir en el archivo existente
                const writable = await creditosFileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log('✅ Créditos guardados automáticamente en archivo seleccionado');
                return;
            } catch (e) {
                // Si falla (por ejemplo, el usuario cerró el archivo), intentar descargar
                console.warn('No se pudo escribir en archivo guardado, descargando respaldo:', e);
                creditosFileHandle = null; // Limpiar handle inválido
                localStorage.removeItem(STORAGE_KEYS.creditosFileHandle);
            }
        }
        
        // Descargar automáticamente el archivo de respaldo
        // Usar nombre con fecha para que se actualice el archivo del día
        const fecha = new Date();
        const nombreArchivo = `creditos_respaldo_${fecha.getFullYear()}-${(fecha.getMonth()+1).toString().padStart(2,'0')}-${fecha.getDate().toString().padStart(2,'0')}.json`;
        
        // Descargar automáticamente (se sobrescribirá si ya existe en la carpeta de descargas)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        // Esperar un poco antes de remover para asegurar que la descarga inicie
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        console.log(`✅ Respaldo de ${creditos.length} créditos descargado automáticamente: ${nombreArchivo}`);
    } catch (error) {
        console.error('Error al guardar créditos en archivo:', error);
        // No mostrar error al usuario, solo loggear
    }
}

// Función para seleccionar archivo y guardar créditos automáticamente ahí
async function configurarGuardadoAutomaticoCreditos() {
    if (!('showSaveFilePicker' in window)) {
        alert('Tu navegador no soporta guardado automático en archivo seleccionado.\n\nLos créditos se descargarán automáticamente en tu carpeta de descargas cada vez que se registre un crédito.\n\nEsto funciona perfectamente: el archivo se guardará con el nombre "creditos_respaldo_YYYY-MM-DD.json" y se actualizará automáticamente.');
        return;
    }
    
    try {
        const json = JSON.stringify(creditos, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        
        const handle = await window.showSaveFilePicker({
            suggestedName: 'creditos_respaldo.json',
            types: [{
                description: 'Archivo JSON',
                accept: { 'application/json': ['.json'] }
            }]
        });
        
        // Guardar el handle en variable global (no se puede serializar en localStorage)
        creditosFileHandle = handle;
        
        // Escribir el archivo inicial
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        // Guardar indicador de que está configurado
        localStorage.setItem(STORAGE_KEYS.creditosFileHandle, 'configurado');
        
        // Actualizar el botón para mostrar que está activo
        const btn = document.getElementById('btnConfigurarGuardadoCreditos');
        if (btn) {
            btn.textContent = '✅ Guardado automático activo';
            btn.classList.add('btn-success');
            btn.classList.remove('btn-primary');
        }
        
        alert('✅ Guardado automático configurado.\n\nLos créditos se guardarán automáticamente en este archivo cada vez que se registre un crédito.\n\nNota: Si cierras el navegador, necesitarás seleccionar el archivo nuevamente la próxima vez.');
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error al configurar guardado automático:', error);
            alert('Error al configurar el guardado automático: ' + error.message);
        }
    }
}

function agregarCredito() {
    const cliente = document.getElementById('creditoCliente').value.trim();
    const telefono = document.getElementById('creditoTelefono').value.trim();
    const producto = document.getElementById('creditoProducto').value.trim();
    const monto = Number(document.getElementById('creditoMonto').value) || 0;
    const fechaInput = document.getElementById('creditoFecha').value;
    const notas = document.getElementById('creditoNotas').value.trim();
    
    if (!cliente || !producto || monto <= 0) {
        alert('Por favor completa todos los campos obligatorios (Cliente, Producto/Servicio y Monto).');
        return;
    }
    
    const fecha = fechaInput ? new Date(fechaInput) : new Date();
    fecha.setHours(new Date().getHours(), new Date().getMinutes(), 0, 0);
    
    const nuevoCredito = {
        id: Date.now(),
        cliente: cliente,
        telefono: telefono || '',
        producto: producto,
        monto: monto,
        fecha: fecha.toISOString(),
        notas: notas || '',
        pagado: false,
        fechaPago: null
    };
    
    creditos.push(nuevoCredito);
    
    // Ordenar por fecha (más recientes primero)
    creditos.sort((a, b) => {
        const fechaA = a.fecha ? new Date(a.fecha).getTime() : 0;
        const fechaB = b.fecha ? new Date(b.fecha).getTime() : 0;
        return fechaB - fechaA;
    });
    
    guardarCreditos();
    limpiarFormCredito();
    renderCreditos();
    actualizarEstadisticasCreditos();
    
    alert('✅ Crédito agregado exitosamente.');
}

function editarCredito(id) {
    const credito = creditos.find(c => String(c.id) === String(id));
    if (!credito) {
        alert('No se encontró el crédito.');
        return;
    }
    
    // Llenar el formulario con los datos del crédito
    document.getElementById('creditoCliente').value = credito.cliente || '';
    document.getElementById('creditoTelefono').value = credito.telefono || '';
    document.getElementById('creditoProducto').value = credito.producto || '';
    document.getElementById('creditoMonto').value = credito.monto || 0;
    document.getElementById('creditoNotas').value = credito.notas || '';
    
    if (credito.fecha) {
        const fecha = new Date(credito.fecha);
        const fechaStr = fecha.toISOString().split('T')[0];
        document.getElementById('creditoFecha').value = fechaStr;
    }
    
    // Cambiar el botón de guardar para que actualice en lugar de crear
    const form = document.getElementById('formCredito');
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = '💾 Actualizar Crédito';
    submitBtn.dataset.editingId = id;
    
    // Scroll al formulario
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function actualizarCredito(id) {
    const credito = creditos.find(c => String(c.id) === String(id));
    if (!credito) {
        alert('No se encontró el crédito.');
        return;
    }
    
    const cliente = document.getElementById('creditoCliente').value.trim();
    const telefono = document.getElementById('creditoTelefono').value.trim();
    const producto = document.getElementById('creditoProducto').value.trim();
    const monto = Number(document.getElementById('creditoMonto').value) || 0;
    const fechaInput = document.getElementById('creditoFecha').value;
    const notas = document.getElementById('creditoNotas').value.trim();
    
    if (!cliente || !producto || monto <= 0) {
        alert('Por favor completa todos los campos obligatorios.');
        return;
    }
    
    const fecha = fechaInput ? new Date(fechaInput) : new Date(credito.fecha);
    fecha.setHours(new Date().getHours(), new Date().getMinutes(), 0, 0);
    
    credito.cliente = cliente;
    credito.telefono = telefono || '';
    credito.producto = producto;
    credito.monto = monto;
    credito.fecha = fecha.toISOString();
    credito.notas = notas || '';
    
    guardarCreditos();
    limpiarFormCredito();
    renderCreditos();
    actualizarEstadisticasCreditos();
    
    alert('✅ Crédito actualizado exitosamente.');
}

function eliminarCredito(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este crédito?')) return;
    
    creditos = creditos.filter(c => String(c.id) !== String(id));
    guardarCreditos();
    renderCreditos();
    actualizarEstadisticasCreditos();
    
    alert('✅ Crédito eliminado exitosamente.');
}

function marcarCreditoComoPagado(id) {
    const credito = creditos.find(c => String(c.id) === String(id));
    if (!credito) {
        alert('No se encontró el crédito.');
        return;
    }
    
    if (credito.pagado) {
        // Si ya está pagado, desmarcar
        credito.pagado = false;
        credito.fechaPago = null;
        alert('✅ Crédito marcado como pendiente.');
    } else {
        // Marcar como pagado
        credito.pagado = true;
        credito.fechaPago = new Date().toISOString();
        alert('✅ Crédito marcado como pagado.');
    }
    
    guardarCreditos();
    renderCreditos();
    actualizarEstadisticasCreditos();
}

function limpiarFormCredito() {
    document.getElementById('formCredito').reset();
    document.getElementById('creditoFecha').value = new Date().toISOString().split('T')[0];
    const submitBtn = document.querySelector('#formCredito button[type="submit"]');
    submitBtn.textContent = '💾 Guardar Crédito';
    delete submitBtn.dataset.editingId;
}

function creditosFiltrados(filtro = 'todos', busqueda = '') {
    let lista = [...creditos];
    
    // Filtrar por estado
    if (filtro === 'pendientes') {
        lista = lista.filter(c => !c.pagado);
    } else if (filtro === 'pagados') {
        lista = lista.filter(c => c.pagado);
    }
    
    // Filtrar por búsqueda
    if (busqueda.trim()) {
        const busquedaLower = busqueda.toLowerCase();
        lista = lista.filter(c => 
            (c.cliente || '').toLowerCase().includes(busquedaLower) ||
            (c.producto || '').toLowerCase().includes(busquedaLower) ||
            (c.telefono || '').includes(busqueda)
        );
    }
    
    return lista;
}

function renderCreditos() {
    const tbody = document.getElementById('tablaCreditos');
    const vacio = document.getElementById('creditosVacio');
    if (!tbody || !vacio) return;
    
    const busqueda = document.getElementById('filtroCreditosBusqueda')?.value || '';
    const lista = creditosFiltrados(creditosFiltroActual, busqueda);
    
    tbody.innerHTML = '';
    
    if (!lista.length) {
        vacio.style.display = 'block';
        return;
    }
    vacio.style.display = 'none';
    
    lista.forEach(credito => {
        const tr = document.createElement('tr');
        if (credito.pagado) {
            tr.style.opacity = '0.7';
            tr.style.backgroundColor = '#f0f0f0';
        }
        
        const fecha = new Date(credito.fecha);
        const tdFecha = document.createElement('td');
        tdFecha.textContent = fecha.toLocaleDateString('es-CO', {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit'
        });
        
        const tdCliente = document.createElement('td');
        tdCliente.textContent = credito.cliente || '';
        tdCliente.style.fontWeight = '500';
        
        const tdTelefono = document.createElement('td');
        tdTelefono.textContent = credito.telefono || '-';
        
        const tdProducto = document.createElement('td');
        tdProducto.textContent = credito.producto || '';
        
        const tdMonto = document.createElement('td');
        tdMonto.className = 'text-right';
        tdMonto.textContent = formatoPrecio(credito.monto);
        
        const tdEstado = document.createElement('td');
        tdEstado.className = 'text-center';
        const estadoBadge = document.createElement('span');
        estadoBadge.style.padding = '4px 8px';
        estadoBadge.style.borderRadius = '4px';
        estadoBadge.style.fontSize = '0.75rem';
        estadoBadge.style.fontWeight = 'bold';
        if (credito.pagado) {
            estadoBadge.textContent = '✅ Pagado';
            estadoBadge.style.backgroundColor = '#4caf50';
            estadoBadge.style.color = '#fff';
        } else {
            estadoBadge.textContent = '⏳ Pendiente';
            estadoBadge.style.backgroundColor = '#ff9800';
            estadoBadge.style.color = '#fff';
        }
        tdEstado.appendChild(estadoBadge);
        
        const tdAcciones = document.createElement('td');
        tdAcciones.className = 'text-center';
        tdAcciones.style.display = 'flex';
        tdAcciones.style.gap = '4px';
        tdAcciones.style.justifyContent = 'center';
        
        const btnEditar = document.createElement('button');
        btnEditar.className = 'btn btn-secondary btn-sm';
        btnEditar.textContent = '✏️';
        btnEditar.title = 'Editar';
        btnEditar.addEventListener('click', () => editarCredito(credito.id));
        
        const btnPagar = document.createElement('button');
        btnPagar.className = 'btn btn-success btn-sm';
        btnPagar.textContent = credito.pagado ? '↩️' : '✅';
        btnPagar.title = credito.pagado ? 'Marcar como pendiente' : 'Marcar como pagado';
        btnPagar.addEventListener('click', () => marcarCreditoComoPagado(credito.id));
        
        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'btn btn-danger btn-sm';
        btnEliminar.textContent = '🗑️';
        btnEliminar.title = 'Eliminar';
        btnEliminar.addEventListener('click', () => eliminarCredito(credito.id));
        
        tdAcciones.appendChild(btnEditar);
        tdAcciones.appendChild(btnPagar);
        tdAcciones.appendChild(btnEliminar);
        
        tr.appendChild(tdFecha);
        tr.appendChild(tdCliente);
        tr.appendChild(tdTelefono);
        tr.appendChild(tdProducto);
        tr.appendChild(tdMonto);
        tr.appendChild(tdEstado);
        tr.appendChild(tdAcciones);
        tbody.appendChild(tr);
    });
}

function actualizarEstadisticasCreditos() {
    const total = creditos.length;
    const pendientes = creditos.filter(c => !c.pagado);
    const pagados = creditos.filter(c => c.pagado);
    
    const montoPendiente = pendientes.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
    const montoPagado = pagados.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
    
    const elTotal = document.getElementById('creditosTotal');
    const elPendiente = document.getElementById('creditosPendiente');
    const elPagado = document.getElementById('creditosPagado');
    
    if (elTotal) elTotal.textContent = total;
    if (elPendiente) elPendiente.textContent = formatoPrecio(montoPendiente);
    if (elPagado) elPagado.textContent = formatoPrecio(montoPagado);
}

function exportarCreditos() {
    if (!creditos.length) {
        alert('No hay créditos para exportar.');
        return;
    }
    
    const json = JSON.stringify(creditos, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fecha = new Date();
    a.download = `creditos_${fecha.getFullYear()}-${(fecha.getMonth()+1).toString().padStart(2,'0')}-${fecha.getDate().toString().padStart(2,'0')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* ============================================================
   GESTIÓN DE TAREAS
============================================================ */

async function guardarTareas() {
    try {
        // Asegurar que todas las tareas tengan ID válido
        const tareasConId = tareas.map(tarea => {
            if (!tarea.id || tarea.id === null || tarea.id === undefined) {
                return {
                    ...tarea,
                    id: Date.now() + Math.random()
                };
            }
            return tarea;
        });
        
        // Convertir tareas a objetos con id como key para IndexedDB
        const tareasObjetos = tareasConId.map(tarea => ({
            id: tarea.id,
            ...tarea
        }));
        
        // Guardar en IndexedDB
        await guardarEnIndexedDB(STORES.tareas, tareasObjetos);
        console.log(`✅ ${tareasObjetos.length} tareas guardadas en IndexedDB`);
        
        // También guardar en localStorage como respaldo
        try {
            localStorage.setItem(STORAGE_KEYS.tareas, JSON.stringify(tareasConId));
            console.log('✅ Tareas guardadas también en localStorage');
        } catch (e) {
            console.warn('No se pudo guardar tareas en localStorage:', e);
        }
        
    } catch (error) {
        console.error('Error al guardar tareas en IndexedDB:', error);
        // Fallback a localStorage si IndexedDB falla
        try {
            localStorage.setItem(STORAGE_KEYS.tareas, JSON.stringify(tareas));
            console.log('⚠️ Tareas guardadas en localStorage (fallback)');
        } catch (e) {
            console.error('Error crítico al guardar tareas:', e);
        }
    }
    
    // Guardar automáticamente en archivo para respaldo
    await guardarTareasEnArchivo();
}

// Guardar tareas automáticamente en archivo (respaldo seguro)
async function guardarTareasEnArchivo() {
    try {
        if (!tareas || tareas.length === 0) {
            console.log('No hay tareas para guardar en archivo');
            return;
        }
        
        const json = JSON.stringify(tareas, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        
        // Intentar usar File System Access API si está disponible y hay un handle guardado
        if ('showSaveFilePicker' in window && tareasFileHandle) {
            try {
                // Escribir en el archivo existente
                const writable = await tareasFileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                console.log('✅ Tareas guardadas automáticamente en archivo seleccionado');
                return;
            } catch (e) {
                // Si falla (por ejemplo, el usuario cerró el archivo), intentar descargar
                console.warn('No se pudo escribir en archivo guardado, descargando respaldo:', e);
                tareasFileHandle = null; // Limpiar handle inválido
                localStorage.removeItem(STORAGE_KEYS.tareasFileHandle);
            }
        }
        
        // Descargar automáticamente el archivo de respaldo
        const fecha = new Date();
        const nombreArchivo = `tareas_respaldo_${fecha.getFullYear()}-${(fecha.getMonth()+1).toString().padStart(2,'0')}-${fecha.getDate().toString().padStart(2,'0')}.json`;
        
        // Descargar automáticamente (se sobrescribirá si ya existe en la carpeta de descargas)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        console.log(`✅ Respaldo de ${tareas.length} tareas descargado automáticamente: ${nombreArchivo}`);
    } catch (error) {
        console.error('Error al guardar tareas en archivo:', error);
    }
}

// Función para seleccionar archivo y guardar tareas automáticamente ahí
async function configurarGuardadoAutomaticoTareas() {
    if (!('showSaveFilePicker' in window)) {
        alert('Tu navegador no soporta guardado automático en archivo seleccionado.\n\nLas tareas se descargarán automáticamente en tu carpeta de descargas cada vez que se registre una tarea.\n\nEsto funciona perfectamente: el archivo se guardará con el nombre "tareas_respaldo_YYYY-MM-DD.json" y se actualizará automáticamente.');
        return;
    }
    
    try {
        const json = JSON.stringify(tareas, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        
        const handle = await window.showSaveFilePicker({
            suggestedName: 'tareas_respaldo.json',
            types: [{
                description: 'Archivo JSON',
                accept: { 'application/json': ['.json'] }
            }]
        });
        
        // Guardar el handle en variable global
        tareasFileHandle = handle;
        
        // Escribir el archivo inicial
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        // Guardar indicador de que está configurado
        localStorage.setItem(STORAGE_KEYS.tareasFileHandle, 'configurado');
        
        // Actualizar el botón para mostrar que está activo
        const btn = document.getElementById('btnConfigurarGuardadoTareas');
        if (btn) {
            btn.textContent = '✅ Guardado automático activo';
            btn.classList.add('btn-success');
            btn.classList.remove('btn-primary');
        }
        
        alert('✅ Guardado automático configurado.\n\nLas tareas se guardarán automáticamente en este archivo cada vez que se registre una tarea.\n\nNota: Si cierras el navegador, necesitarás seleccionar el archivo nuevamente la próxima vez.');
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error al configurar guardado automático:', error);
            alert('Error al configurar el guardado automático: ' + error.message);
        }
    }
}

function agregarTarea() {
    const nombre = document.getElementById('tareaNombre').value.trim();
    const fechaEntregaInput = document.getElementById('tareaFechaEntrega').value;
    const descripcion = document.getElementById('tareaDescripcion').value.trim();
    const pagada = document.getElementById('tareaPagada').checked;
    
    if (!nombre || !fechaEntregaInput) {
        alert('Por favor completa todos los campos obligatorios (Nombre y Fecha/Hora de Entrega).');
        return;
    }
    
    const fechaEntrega = new Date(fechaEntregaInput);
    if (isNaN(fechaEntrega.getTime())) {
        alert('La fecha de entrega no es válida.');
        return;
    }
    
    const nuevaTarea = {
        id: Date.now(),
        nombre: nombre,
        descripcion: descripcion || '',
        fechaEntrega: fechaEntrega.toISOString(),
        pagada: pagada,
        completada: false,
        fechaCreacion: new Date().toISOString()
    };
    
    tareas.push(nuevaTarea);
    
    // Ordenar por fecha de entrega (más próximas primero)
    tareas.sort((a, b) => {
        const fechaA = a.fechaEntrega ? new Date(a.fechaEntrega).getTime() : 0;
        const fechaB = b.fechaEntrega ? new Date(b.fechaEntrega).getTime() : 0;
        return fechaA - fechaB;
    });
    
    guardarTareas();
    limpiarFormTarea();
    renderTareas();
    actualizarEstadisticasTareas();
    iniciarCountdownTareas();
    
    alert('✅ Tarea agregada exitosamente.');
}

function editarTarea(id) {
    const tarea = tareas.find(t => String(t.id) === String(id));
    if (!tarea) {
        alert('No se encontró la tarea.');
        return;
    }
    
    // Llenar el formulario con los datos de la tarea
    document.getElementById('tareaNombre').value = tarea.nombre || '';
    document.getElementById('tareaDescripcion').value = tarea.descripcion || '';
    document.getElementById('tareaPagada').checked = tarea.pagada || false;
    
    if (tarea.fechaEntrega) {
        const fecha = new Date(tarea.fechaEntrega);
        // Formato para datetime-local: YYYY-MM-DDTHH:mm
        const fechaStr = fecha.toISOString().slice(0, 16);
        document.getElementById('tareaFechaEntrega').value = fechaStr;
    }
    
    // Cambiar el botón de guardar para que actualice en lugar de crear
    const form = document.getElementById('formTarea');
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = '💾 Actualizar Tarea';
    submitBtn.dataset.editingId = id;
    
    // Scroll al formulario
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function actualizarTarea(id) {
    const tarea = tareas.find(t => String(t.id) === String(id));
    if (!tarea) {
        alert('No se encontró la tarea.');
        return;
    }
    
    const nombre = document.getElementById('tareaNombre').value.trim();
    const fechaEntregaInput = document.getElementById('tareaFechaEntrega').value;
    const descripcion = document.getElementById('tareaDescripcion').value.trim();
    const pagada = document.getElementById('tareaPagada').checked;
    
    if (!nombre || !fechaEntregaInput) {
        alert('Por favor completa todos los campos obligatorios.');
        return;
    }
    
    const fechaEntrega = new Date(fechaEntregaInput);
    if (isNaN(fechaEntrega.getTime())) {
        alert('La fecha de entrega no es válida.');
        return;
    }
    
    tarea.nombre = nombre;
    tarea.descripcion = descripcion || '';
    tarea.fechaEntrega = fechaEntrega.toISOString();
    tarea.pagada = pagada;
    
    guardarTareas();
    limpiarFormTarea();
    renderTareas();
    actualizarEstadisticasTareas();
    
    alert('✅ Tarea actualizada exitosamente.');
}

function eliminarTarea(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta tarea?')) return;
    
    tareas = tareas.filter(t => String(t.id) !== String(id));
    guardarTareas();
    renderTareas();
    actualizarEstadisticasTareas();
    
    alert('✅ Tarea eliminada exitosamente.');
}

function marcarTareaComoCompletada(id) {
    const tarea = tareas.find(t => String(t.id) === String(id));
    if (!tarea) {
        alert('No se encontró la tarea.');
        return;
    }
    
    if (tarea.completada) {
        tarea.completada = false;
        alert('✅ Tarea marcada como pendiente.');
    } else {
        tarea.completada = true;
        alert('✅ Tarea marcada como completada.');
    }
    
    guardarTareas();
    renderTareas();
    actualizarEstadisticasTareas();
}

function marcarTareaComoPagada(id) {
    const tarea = tareas.find(t => String(t.id) === String(id));
    if (!tarea) {
        alert('No se encontró la tarea.');
        return;
    }
    
    if (tarea.pagada) {
        tarea.pagada = false;
        alert('✅ Tarea marcada como no pagada.');
    } else {
        tarea.pagada = true;
        alert('✅ Tarea marcada como pagada.');
    }
    
    guardarTareas();
    renderTareas();
    actualizarEstadisticasTareas();
}

function limpiarFormTarea() {
    document.getElementById('formTarea').reset();
    // Establecer fecha/hora por defecto (1 hora desde ahora)
    const ahora = new Date();
    ahora.setHours(ahora.getHours() + 1);
    const fechaStr = ahora.toISOString().slice(0, 16);
    document.getElementById('tareaFechaEntrega').value = fechaStr;
    const submitBtn = document.querySelector('#formTarea button[type="submit"]');
    submitBtn.textContent = '💾 Guardar Tarea';
    delete submitBtn.dataset.editingId;
}

function tareasFiltradas(filtro = 'todas', busqueda = '') {
    let lista = [...tareas];
    
    // Filtrar por estado
    if (filtro === 'pendientes') {
        lista = lista.filter(t => !t.completada);
    } else if (filtro === 'completadas') {
        lista = lista.filter(t => t.completada);
    } else if (filtro === 'pagadas') {
        lista = lista.filter(t => t.pagada);
    }
    
    // Filtrar por búsqueda
    if (busqueda.trim()) {
        const busquedaLower = busqueda.toLowerCase();
        lista = lista.filter(t => 
            (t.nombre || '').toLowerCase().includes(busquedaLower) ||
            (t.descripcion || '').toLowerCase().includes(busquedaLower)
        );
    }
    
    return lista;
}

// Calcular tiempo restante para una tarea
function calcularTiempoRestante(fechaEntrega) {
    const ahora = new Date();
    const fecha = new Date(fechaEntrega);
    const diferencia = fecha.getTime() - ahora.getTime();
    
    if (diferencia <= 0) {
        return { pasado: true, texto: 'Vencida', clase: 'tarea-vencida' };
    }
    
    const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((diferencia % (1000 * 60)) / 1000);
    
    let texto = '';
    let clase = 'tarea-tiempo-normal';
    
    if (dias > 0) {
        texto = `${dias}d ${horas}h`;
        if (dias <= 1) clase = 'tarea-tiempo-urgente';
    } else if (horas > 0) {
        texto = `${horas}h ${minutos}m`;
        clase = 'tarea-tiempo-urgente';
    } else if (minutos > 0) {
        texto = `${minutos}m ${segundos}s`;
        clase = 'tarea-tiempo-muy-urgente';
    } else {
        texto = `${segundos}s`;
        clase = 'tarea-tiempo-muy-urgente';
    }
    
    return { pasado: false, texto, clase };
}

function renderTareas() {
    const tbody = document.getElementById('tablaTareas');
    const vacio = document.getElementById('tareasVacio');
    if (!tbody || !vacio) return;
    
    const busqueda = document.getElementById('filtroTareasBusqueda')?.value || '';
    const lista = tareasFiltradas(tareasFiltroActual, busqueda);
    
    tbody.innerHTML = '';
    
    if (!lista.length) {
        vacio.style.display = 'block';
        return;
    }
    vacio.style.display = 'none';
    
    lista.forEach(tarea => {
        const tr = document.createElement('tr');
        if (tarea.completada) {
            tr.style.opacity = '0.7';
            tr.style.backgroundColor = '#f0f0f0';
        }
        
        const tdNombre = document.createElement('td');
        tdNombre.style.fontWeight = '500';
        tdNombre.textContent = tarea.nombre || '';
        
        const tdDescripcion = document.createElement('td');
        tdDescripcion.textContent = tarea.descripcion || '-';
        tdDescripcion.style.maxWidth = '300px';
        tdDescripcion.style.overflow = 'hidden';
        tdDescripcion.style.textOverflow = 'ellipsis';
        tdDescripcion.style.whiteSpace = 'nowrap';
        
        const tdFecha = document.createElement('td');
        if (tarea.fechaEntrega) {
            const fecha = new Date(tarea.fechaEntrega);
            tdFecha.textContent = fecha.toLocaleString('es-CO', {
                year: '2-digit',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            tdFecha.textContent = '-';
        }
        
        const tdTiempo = document.createElement('td');
        tdTiempo.className = 'text-center';
        const tiempoSpan = document.createElement('span');
        tiempoSpan.dataset.tareaId = tarea.id;
        tiempoSpan.dataset.fechaEntrega = tarea.fechaEntrega;
        const tiempoRestante = calcularTiempoRestante(tarea.fechaEntrega);
        tiempoSpan.textContent = tiempoRestante.texto;
        tiempoSpan.className = tiempoRestante.clase;
        tiempoSpan.style.padding = '4px 8px';
        tiempoSpan.style.borderRadius = '4px';
        tiempoSpan.style.fontWeight = 'bold';
        tiempoSpan.style.fontSize = '0.85rem';
        if (tiempoRestante.pasado) {
            tiempoSpan.style.backgroundColor = '#f44336';
            tiempoSpan.style.color = '#fff';
        } else if (tiempoRestante.clase === 'tarea-tiempo-muy-urgente') {
            tiempoSpan.style.backgroundColor = '#ff1744';
            tiempoSpan.style.color = '#fff';
        } else if (tiempoRestante.clase === 'tarea-tiempo-urgente') {
            tiempoSpan.style.backgroundColor = '#ff9800';
            tiempoSpan.style.color = '#fff';
        } else {
            tiempoSpan.style.backgroundColor = '#4caf50';
            tiempoSpan.style.color = '#fff';
        }
        tdTiempo.appendChild(tiempoSpan);
        
        const tdEstado = document.createElement('td');
        tdEstado.className = 'text-center';
        const estadoBadge = document.createElement('span');
        estadoBadge.style.padding = '4px 8px';
        estadoBadge.style.borderRadius = '4px';
        estadoBadge.style.fontSize = '0.75rem';
        estadoBadge.style.fontWeight = 'bold';
        if (tarea.completada) {
            estadoBadge.textContent = '✅ Completada';
            estadoBadge.style.backgroundColor = '#4caf50';
            estadoBadge.style.color = '#fff';
        } else {
            estadoBadge.textContent = '⏳ Pendiente';
            estadoBadge.style.backgroundColor = '#ff9800';
            estadoBadge.style.color = '#fff';
        }
        tdEstado.appendChild(estadoBadge);
        
        const tdAcciones = document.createElement('td');
        tdAcciones.className = 'text-center';
        tdAcciones.style.display = 'flex';
        tdAcciones.style.gap = '4px';
        tdAcciones.style.justifyContent = 'center';
        
        const btnEditar = document.createElement('button');
        btnEditar.className = 'btn btn-secondary btn-sm';
        btnEditar.textContent = '✏️';
        btnEditar.title = 'Editar';
        btnEditar.addEventListener('click', () => editarTarea(tarea.id));
        
        const btnCompletar = document.createElement('button');
        btnCompletar.className = 'btn btn-success btn-sm';
        btnCompletar.textContent = tarea.completada ? '↩️' : '✅';
        btnCompletar.title = tarea.completada ? 'Marcar como pendiente' : 'Marcar como completada';
        btnCompletar.addEventListener('click', () => marcarTareaComoCompletada(tarea.id));
        
        const btnPagar = document.createElement('button');
        btnPagar.className = 'btn btn-primary btn-sm';
        btnPagar.textContent = tarea.pagada ? '💰' : '💵';
        btnPagar.title = tarea.pagada ? 'Marcar como no pagada' : 'Marcar como pagada';
        btnPagar.style.opacity = tarea.pagada ? '1' : '0.7';
        btnPagar.addEventListener('click', () => marcarTareaComoPagada(tarea.id));
        
        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'btn btn-danger btn-sm';
        btnEliminar.textContent = '🗑️';
        btnEliminar.title = 'Eliminar';
        btnEliminar.addEventListener('click', () => eliminarTarea(tarea.id));
        
        tdAcciones.appendChild(btnEditar);
        tdAcciones.appendChild(btnCompletar);
        tdAcciones.appendChild(btnPagar);
        tdAcciones.appendChild(btnEliminar);
        
        tr.appendChild(tdNombre);
        tr.appendChild(tdDescripcion);
        tr.appendChild(tdFecha);
        tr.appendChild(tdTiempo);
        tr.appendChild(tdEstado);
        tr.appendChild(tdAcciones);
        tbody.appendChild(tr);
    });
    
    // Iniciar countdown si no está corriendo
    iniciarCountdownTareas();
}

// Iniciar countdown para actualizar tiempos restantes cada segundo
function iniciarCountdownTareas() {
    // Limpiar intervalo anterior si existe
    if (intervaloCountdownTareas) {
        clearInterval(intervaloCountdownTareas);
    }
    
    // Actualizar cada segundo
    intervaloCountdownTareas = setInterval(() => {
        const elementosTiempo = document.querySelectorAll('[data-tarea-id]');
        elementosTiempo.forEach(el => {
            const fechaEntrega = el.dataset.fechaEntrega;
            if (!fechaEntrega) return;
            
            const tiempoRestante = calcularTiempoRestante(fechaEntrega);
            el.textContent = tiempoRestante.texto;
            el.className = tiempoRestante.clase;
            
            // Actualizar estilos
            el.style.padding = '4px 8px';
            el.style.borderRadius = '4px';
            el.style.fontWeight = 'bold';
            el.style.fontSize = '0.85rem';
            
            if (tiempoRestante.pasado) {
                el.style.backgroundColor = '#f44336';
                el.style.color = '#fff';
            } else if (tiempoRestante.clase === 'tarea-tiempo-muy-urgente') {
                el.style.backgroundColor = '#ff1744';
                el.style.color = '#fff';
            } else if (tiempoRestante.clase === 'tarea-tiempo-urgente') {
                el.style.backgroundColor = '#ff9800';
                el.style.color = '#fff';
            } else {
                el.style.backgroundColor = '#4caf50';
                el.style.color = '#fff';
            }
        });
    }, 1000); // Actualizar cada segundo
}

function actualizarEstadisticasTareas() {
    const total = tareas.length;
    const pendientes = tareas.filter(t => !t.completada);
    const completadas = tareas.filter(t => t.completada);
    const pagadas = tareas.filter(t => t.pagada);
    
    const elTotal = document.getElementById('tareasTotal');
    const elPendientes = document.getElementById('tareasPendientes');
    const elCompletadas = document.getElementById('tareasCompletadas');
    const elPagadas = document.getElementById('tareasPagadas');
    
    if (elTotal) elTotal.textContent = total;
    if (elPendientes) elPendientes.textContent = pendientes.length;
    if (elCompletadas) elCompletadas.textContent = completadas.length;
    if (elPagadas) elPagadas.textContent = pagadas.length;
}

function exportarTareas() {
    if (!tareas.length) {
        alert('No hay tareas para exportar.');
        return;
    }
    
    const json = JSON.stringify(tareas, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fecha = new Date();
    a.download = `tareas_${fecha.getFullYear()}-${(fecha.getMonth()+1).toString().padStart(2,'0')}-${fecha.getDate().toString().padStart(2,'0')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ================ GESTIÓN DE SERVICIOS ================
async function guardarServicios() {
    try {
        // Asegurar que todos los servicios tengan ID válido
        const serviciosConId = servicios.map(servicio => {
            if (!servicio.id || servicio.id === null || servicio.id === undefined) {
                return {
                    ...servicio,
                    id: Date.now() + Math.random()
                };
            }
            return servicio;
        });
        
        // Convertir servicios a objetos con id como key para IndexedDB
        const serviciosObjetos = serviciosConId.map(servicio => ({
            id: servicio.id,
            ...servicio
        }));
        
        // Guardar en IndexedDB
        await guardarEnIndexedDB(STORES.servicios, serviciosObjetos);
        console.log(`✅ ${serviciosObjetos.length} servicios guardados en IndexedDB`);
        
        // También guardar en localStorage como respaldo
        try {
            localStorage.setItem(STORAGE_KEYS.servicios, JSON.stringify(serviciosConId));
            console.log('✅ Servicios guardados también en localStorage');
        } catch (e) {
            console.warn('No se pudo guardar servicios en localStorage:', e);
        }
        
        servicios = serviciosConId;
    } catch (error) {
        console.error('Error al guardar servicios:', error);
        // Fallback a localStorage
        try {
            localStorage.setItem(STORAGE_KEYS.servicios, JSON.stringify(servicios));
            console.log('✅ Servicios guardados en localStorage (fallback)');
        } catch (e) {
            console.error('Error crítico al guardar servicios:', e);
        }
    }
}

function normalizarVariantesServicios(variantes) {
    if (!variantes) return [];
    if (typeof variantes === 'string') {
        // Intentar parsear como JSON primero
        try {
            const parsed = JSON.parse(variantes);
            if (Array.isArray(parsed)) {
                return parsed.map(v => {
                    if (typeof v === 'string') {
                        return { id: v.trim(), nombre: v.trim(), precio: 0, imagen: '', sku: '' };
                    }
                    return {
                        id: String(v.id || v.nombre || '').trim(),
                        nombre: String(v.nombre || v.id || '').trim(),
                        precio: Number(v.precio) || 0,
                        imagen: String(v.imagen || '').trim(),
                        sku: String(v.sku || '').trim()
                    };
                }).filter(v => v.id || v.nombre);
            }
        } catch (e) {
            // Si no es JSON, tratar como lista separada por comas
            return variantes.split(',').map(v => v.trim()).filter(Boolean).map(v => ({
                id: v,
                nombre: v,
                precio: 0,
                imagen: '',
                sku: ''
            }));
        }
    }
    if (Array.isArray(variantes)) {
        return variantes.map(v => {
            if (typeof v === 'string') {
                return { id: v.trim(), nombre: v.trim(), precio: 0, imagen: '', sku: '' };
            }
            return {
                id: String(v.id || v.nombre || '').trim(),
                nombre: String(v.nombre || v.id || '').trim(),
                precio: Number(v.precio) || 0,
                imagen: String(v.imagen || '').trim(),
                sku: String(v.sku || '').trim()
            };
        }).filter(v => v.id || v.nombre);
    }
    return [];
}

/* -------- Admin: editor visual de variantes para servicios -------- */
function crearFilaVarianteEditorServicio(datos) {
    const v = {
        id: String(datos?.id || datos?.nombre || '').trim(),
        nombre: String(datos?.nombre || datos?.id || '').trim(),
        precio: Number(datos?.precio) || 0,
        imagen: String(datos?.imagen || '').trim(),
        sku: String(datos?.sku || '').trim()
    };

    const row = document.createElement('div');
    row.className = 'var-row var-row-servicio';

    const inpNombre = document.createElement('input');
    inpNombre.type = 'text';
    inpNombre.placeholder = 'Nombre (ej: Tamaño pequeño / Color rojo)';
    inpNombre.value = v.nombre || v.id;
    inpNombre.dataset.role = 'nombre';

    const inpPrecio = document.createElement('input');
    inpPrecio.type = 'number';
    inpPrecio.min = '0';
    inpPrecio.step = '50';
    inpPrecio.placeholder = 'Precio (0 = usa base)';
    inpPrecio.value = v.precio || 0;
    inpPrecio.dataset.role = 'precio';

    const inpImagen = document.createElement('input');
    inpImagen.type = 'text';
    inpImagen.placeholder = 'URL imagen (opcional)';
    inpImagen.value = v.imagen || '';
    inpImagen.dataset.role = 'imagen';
    inpImagen.className = 'var-col-wide';

    const inpSku = document.createElement('input');
    inpSku.type = 'text';
    inpSku.placeholder = 'SKU / código opcional';
    inpSku.value = v.sku || '';
    inpSku.dataset.role = 'sku';

    const thumb = document.createElement('img');
    thumb.className = 'var-thumb';
    thumb.alt = 'img';
    thumb.src = v.imagen ? v.imagen : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="#fff7e6"/><text x="50%" y="52%" font-size="10" text-anchor="middle" fill="#999">IMG</text></svg>');

    const chip = document.createElement('div');
    chip.className = 'var-chip';
    chip.appendChild(thumb);
    chip.appendChild(inpImagen);

    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.className = 'btn btn-danger var-remove';
    btnRemove.textContent = '✖';
    btnRemove.title = 'Eliminar variante';
    btnRemove.addEventListener('click', () => {
        row.remove();
        syncVariantesEditorServicioToTextarea();
    });

    // live preview
    inpImagen.addEventListener('input', () => {
        const url = inpImagen.value.trim();
        if (url) thumb.src = url;
        syncVariantesEditorServicioToTextarea();
    });

    [inpNombre, inpPrecio, inpSku].forEach(el => {
        el.addEventListener('input', syncVariantesEditorServicioToTextarea);
    });

    row.appendChild(inpNombre);
    row.appendChild(inpPrecio);
    row.appendChild(chip);
    row.appendChild(inpSku);
    row.appendChild(btnRemove);
    return row;
}

function leerVariantesDesdeEditorServicio() {
    const cont = document.getElementById('variantesEditorServicio');
    if (!cont) return [];
    const rows = Array.from(cont.querySelectorAll('.var-row'));
    const arr = rows.map(r => {
        const nombre = (r.querySelector('[data-role="nombre"]')?.value || '').trim();
        const precio = Number(r.querySelector('[data-role="precio"]')?.value) || 0;
        const imagen = (r.querySelector('[data-role="imagen"]')?.value || '').trim();
        const sku = (r.querySelector('[data-role="sku"]')?.value || '').trim();

        const id = nombre || ('var_' + Math.random().toString(16).slice(2, 8));
        if (!id) return null;
        return { id, nombre: nombre || id, precio, imagen, sku };
    }).filter(Boolean);

    // dedupe ids
    const seen = new Set();
    const out = [];
    for (const v of arr) {
        let id = String(v.id || v.nombre).trim();
        if (!id) continue;
        if (seen.has(id)) {
            id = id + '_' + Math.random().toString(16).slice(2, 5);
            v.id = id;
        }
        seen.add(id);
        out.push(v);
    }
    return out;
}

function syncVariantesEditorServicioToTextarea() {
    const ta = document.getElementById('servicioVariantes');
    if (!ta) return;
    const arr = leerVariantesDesdeEditorServicio();
    ta.value = arr.length ? JSON.stringify(arr) : '';
}

function pintarEditorVariantesServicio(variantes) {
    const cont = document.getElementById('variantesEditorServicio');
    if (!cont) return;
    cont.innerHTML = '';
    const vars = normalizarVariantesServicios(variantes || []);
    vars.forEach(v => cont.appendChild(crearFilaVarianteEditorServicio(v)));
    syncVariantesEditorServicioToTextarea();
}

function initVariantesEditorServicioAdmin() {
    const cont = document.getElementById('variantesEditorServicio');
    if (!cont) return; // no admin page
    const btnAdd = document.getElementById('btnAddVarianteServicio');
    const btnAuto = document.getElementById('btnAutoVarDesdeTextoServicio');
    const btnClear = document.getElementById('btnLimpiarVariantesServicio');
    const ta = document.getElementById('servicioVariantes');

    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            cont.appendChild(crearFilaVarianteEditorServicio({ nombre: '' }));
            syncVariantesEditorServicioToTextarea();
        });
    }
    if (btnAuto) {
        btnAuto.addEventListener('click', () => {
            const ejemplo = prompt('Escribe las variantes separadas por coma (ej: pequeño, mediano, grande):', '');
            if (ejemplo === null) return;
            const lista = ejemplo.split(',').map(s => s.trim()).filter(Boolean).map(s => ({ id: s, nombre: s, precio: 0, imagen: '', sku: '' }));
            pintarEditorVariantesServicio(lista);
        });
    }
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (!confirm('¿Borrar todas las variantes de este servicio?')) return;
            cont.innerHTML = '';
            if (ta) ta.value = '';
        });
    }

    // if textarea already has json, try load it
    if (ta && ta.value && ta.value.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(ta.value.trim());
            pintarEditorVariantesServicio(parsed);
        } catch { /* ignore */ }
    }
}

function obtenerVarianteServicioPorId(servicio, idVar) {
    const vars = normalizarVariantesServicios(servicio.variantes || []);
    return vars.find(v => String(v.id) === String(idVar)) || null;
}

function renderServicios() {
    const grid = document.getElementById('serviciosGrid');
    const vacio = document.getElementById('serviciosVacios');
    if (!grid) return;
    
    if (!servicios.length) {
        if (vacio) vacio.style.display = 'block';
        grid.innerHTML = '';
        return;
    }
    
    if (vacio) vacio.style.display = 'none';
    grid.innerHTML = '';
    
    servicios.forEach(servicio => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.style.cursor = 'pointer';
        
        const imagen = servicio.imagen || 'https://via.placeholder.com/300x200?text=Sin+imagen';
        const nombre = servicio.nombre || 'Sin nombre';
        const descripcion = servicio.descripcion || 'Sin descripción';
        const precioBase = Number(servicio.precio) || 0;
        const variantes = normalizarVariantesServicios(servicio.variantes || []);
        
        let precioTexto = `$${precioBase.toLocaleString('es-CO')}`;
        if (variantes.length > 0) {
            precioTexto = 'Desde $' + Math.min(precioBase, ...variantes.map(v => v.precio || precioBase)).toLocaleString('es-CO');
        }
        
        let variantesTexto = '';
        if (variantes.length > 0) {
            variantesTexto = `<p style="margin: 8px 0 0 0; color: #7b2cff; font-size: 0.85rem; font-weight: 500;">${variantes.length} variante${variantes.length > 1 ? 's' : ''} disponible${variantes.length > 1 ? 's' : ''}</p>`;
        }
        
        card.innerHTML = `
            <div class="product-image" style="background-image: url('${imagen}'); background-size: cover; background-position: center; height: 200px; border-radius: 8px 8px 0 0;"></div>
            <div class="product-info" style="padding: 15px;">
                <h3 style="margin: 0 0 8px 0; font-size: 1.1rem; color: #333;">${nombre}</h3>
                <p style="margin: 0 0 12px 0; color: #666; font-size: 0.9rem; line-height: 1.4;">${descripcion}</p>
                ${variantesTexto}
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
                    <span style="font-size: 1.3rem; font-weight: bold; color: #ff6b35;">${precioTexto}</span>
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

function renderServiciosSolicitar() {
    const grid = document.getElementById('serviciosSolicitarGrid');
    const vacio = document.getElementById('serviciosVaciosSolicitar');
    if (!grid) return;
    
    if (!servicios.length) {
        if (vacio) vacio.style.display = 'block';
        grid.innerHTML = '';
        return;
    }
    
    if (vacio) vacio.style.display = 'none';
    grid.innerHTML = '';
    
    servicios.forEach(servicio => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        const imagen = servicio.imagen || 'https://via.placeholder.com/300x200?text=Sin+imagen';
        const nombre = servicio.nombre || 'Sin nombre';
        const descripcion = servicio.descripcion || 'Sin descripción';
        const precioBase = Number(servicio.precio) || 0;
        const variantes = normalizarVariantesServicios(servicio.variantes || []);
        
        // Generar ID único para este servicio
        const servicioId = `servicio_${servicio.id}`;
        
        let variantesHTML = '';
        if (variantes.length > 0) {
            variantesHTML = `
                <div style="margin: 12px 0;">
                    <label style="display:block;margin-bottom:6px;font-size:0.85rem;font-weight:bold;color:#333;">Selecciona variante:</label>
                    <select id="variante_${servicio.id}" class="servicio-variante-select" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;">
                        <option value="">Sin variante (Precio base)</option>
                        ${variantes.map(v => `<option value="${v.id}" data-precio="${v.precio || precioBase}">${v.nombre} - $${(v.precio || precioBase).toLocaleString('es-CO')}</option>`).join('')}
                    </select>
                </div>
            `;
        }
        
        card.innerHTML = `
            <div class="product-image" style="background-image: url('${imagen}'); background-size: cover; background-position: center; height: 200px; border-radius: 8px 8px 0 0;"></div>
            <div class="product-info" style="padding: 15px;">
                <h3 style="margin: 0 0 8px 0; font-size: 1.1rem; color: #333;">${nombre}</h3>
                <p style="margin: 0 0 12px 0; color: #666; font-size: 0.9rem; line-height: 1.4;">${descripcion}</p>
                <div style="margin-bottom: 12px;">
                    <span id="precio_${servicio.id}" style="font-size: 1.3rem; font-weight: bold; color: #ff6b35;">$${precioBase.toLocaleString('es-CO')}</span>
                </div>
                ${variantesHTML}
                <button class="btn btn-accent btn-sm" style="width:100%;margin-top:12px;" onclick="solicitarServicioWhatsApp('${servicio.id}')">
                    📲 Solicitar este servicio
                </button>
            </div>
        `;
        
        grid.appendChild(card);
        
        // Agregar listener para cambiar precio cuando se selecciona variante
        if (variantes.length > 0) {
            const selectVariante = document.getElementById(`variante_${servicio.id}`);
            const precioDisplay = document.getElementById(`precio_${servicio.id}`);
            if (selectVariante && precioDisplay) {
                selectVariante.addEventListener('change', (e) => {
                    const selectedOption = e.target.options[e.target.selectedIndex];
                    const nuevoPrecio = selectedOption.dataset.precio || precioBase;
                    precioDisplay.textContent = `$${Number(nuevoPrecio).toLocaleString('es-CO')}`;
                });
            }
        }
    });
}

function solicitarServicioWhatsApp(servicioId) {
    const servicio = servicios.find(s => String(s.id) === String(servicioId));
    if (!servicio) {
        alert('Servicio no encontrado.');
        return;
    }
    
    const variantes = normalizarVariantesServicios(servicio.variantes || []);
    let varianteSeleccionada = null;
    let precioFinal = Number(servicio.precio) || 0;
    
    if (variantes.length > 0) {
        const selectVariante = document.getElementById(`variante_${servicio.id}`);
        if (selectVariante && selectVariante.value) {
            varianteSeleccionada = obtenerVarianteServicioPorId(servicio, selectVariante.value);
            if (varianteSeleccionada && varianteSeleccionada.precio > 0) {
                precioFinal = varianteSeleccionada.precio;
            }
        }
    }
    
    const nombreServicio = servicio.nombre || 'Servicio';
    const varianteTexto = varianteSeleccionada ? ` (${varianteSeleccionada.nombre})` : '';
    
    let mensaje = `Hola, quiero solicitar el siguiente servicio:%0A%0A`;
    mensaje += `📄 *${nombreServicio}${varianteTexto}*%0A`;
    mensaje += `💰 Precio: $${precioFinal.toLocaleString('es-CO')}%0A`;
    if (servicio.descripcion) {
        mensaje += `%0A${servicio.descripcion}%0A`;
    }
    mensaje += `%0A---%0A`;
    mensaje += `Por favor, confirma disponibilidad y forma de entrega.`;
    
    const numero = '573016520610';
    const url = 'https://wa.me/' + numero + '?text=' + mensaje;
    window.open(url, '_blank');
}

function renderServiciosAdmin() {
    const lista = document.getElementById('listaServicios');
    const vacio = document.getElementById('serviciosVaciosAdmin');
    if (!lista) return;
    
    if (!servicios.length) {
        if (vacio) vacio.style.display = 'block';
        lista.innerHTML = '';
        return;
    }
    
    if (vacio) vacio.style.display = 'none';
    lista.innerHTML = '';
    
    servicios.forEach(servicio => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.padding = '15px';
        
        const imagen = servicio.imagen || 'https://via.placeholder.com/300x200?text=Sin+imagen';
        const nombre = servicio.nombre || 'Sin nombre';
        const descripcion = servicio.descripcion || 'Sin descripción';
        const precio = Number(servicio.precio) || 0;
        const variantes = normalizarVariantesServicios(servicio.variantes || []);
        
        let variantesInfo = '';
        if (variantes.length > 0) {
            variantesInfo = `<p style="margin: 4px 0 0 0; color: #7b2cff; font-size: 0.85rem; font-weight: 500;">${variantes.length} variante${variantes.length > 1 ? 's' : ''}</p>`;
        }
        
        card.innerHTML = `
            <div style="display: grid; grid-template-columns: 120px 1fr auto; gap: 15px; align-items: start;">
                <div style="background-image: url('${imagen}'); background-size: cover; background-position: center; width: 120px; height: 120px; border-radius: 8px; border: 2px solid #ddd;"></div>
                <div>
                    <h4 style="margin: 0 0 8px 0; font-size: 1.1rem; color: #333;">${nombre}</h4>
                    <p style="margin: 0 0 8px 0; color: #666; font-size: 0.9rem; line-height: 1.4;">${descripcion}</p>
                    <div style="font-size: 1.2rem; font-weight: bold; color: #ff6b35;">$${precio.toLocaleString('es-CO')}</div>
                    ${variantesInfo}
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <button class="btn btn-primary btn-sm" onclick="editarServicio(${JSON.stringify(servicio.id)})">✏️ Editar</button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarServicio(${JSON.stringify(servicio.id)})">🗑️ Eliminar</button>
                </div>
            </div>
        `;
        
        lista.appendChild(card);
    });
}

function agregarServicio() {
    const nombre = document.getElementById('servicioNombre')?.value.trim();
    const descripcion = document.getElementById('servicioDescripcion')?.value.trim();
    const precio = parseFloat(document.getElementById('servicioPrecio')?.value || '0');
    const imagen = document.getElementById('servicioImagen')?.value.trim() || '';
    
    if (!nombre || !descripcion || precio <= 0) {
        alert('Por favor completa todos los campos requeridos (nombre, descripción y precio mayor a 0).');
        return;
    }
    
    // Leer variantes desde el editor visual
    const variantes = leerVariantesDesdeEditorServicio();
    
    const nuevoServicio = {
        id: Date.now() + Math.random(),
        nombre,
        descripcion,
        precio,
        imagen: imagen || 'https://via.placeholder.com/300x200?text=Sin+imagen',
        variantes: variantes.length > 0 ? variantes : null
    };
    
    servicios.push(nuevoServicio);
    guardarServicios();
    limpiarFormServicio();
    renderServiciosAdmin();
    
    alert('✅ Servicio agregado correctamente.');
}

function editarServicio(id) {
    const servicio = servicios.find(s => String(s.id) === String(id));
    if (!servicio) return;
    
    document.getElementById('servicioNombre').value = servicio.nombre || '';
    document.getElementById('servicioDescripcion').value = servicio.descripcion || '';
    document.getElementById('servicioPrecio').value = servicio.precio || '';
    document.getElementById('servicioImagen').value = servicio.imagen || '';
    
    // Cargar variantes en el editor visual
    pintarEditorVariantesServicio(servicio.variantes || []);
    
    // Guardar el ID del servicio que estamos editando
    const form = document.getElementById('formServicio');
    if (form) {
        form.dataset.editandoId = String(servicio.id);
    }
    
    // Cambiar el texto del botón
    const btnSubmit = form?.querySelector('button[type="submit"]');
    if (btnSubmit) {
        btnSubmit.textContent = '💾 Actualizar Servicio';
    }
    
    // Scroll al formulario
    form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function actualizarServicio(id) {
    const nombre = document.getElementById('servicioNombre')?.value.trim();
    const descripcion = document.getElementById('servicioDescripcion')?.value.trim();
    const precio = parseFloat(document.getElementById('servicioPrecio')?.value || '0');
    const imagen = document.getElementById('servicioImagen')?.value.trim() || '';
    
    if (!nombre || !descripcion || precio <= 0) {
        alert('Por favor completa todos los campos requeridos (nombre, descripción y precio mayor a 0).');
        return;
    }
    
    const servicioId = id || document.getElementById('formServicio')?.dataset.editandoId;
    if (!servicioId) return;
    
    const index = servicios.findIndex(s => String(s.id) === String(servicioId));
    if (index === -1) return;
    
    // Leer variantes desde el editor visual
    const variantes = leerVariantesDesdeEditorServicio();
    
    servicios[index] = {
        ...servicios[index],
        nombre,
        descripcion,
        precio,
        imagen: imagen || servicios[index].imagen || 'https://via.placeholder.com/300x200?text=Sin+imagen',
        variantes: variantes.length > 0 ? variantes : null
    };
    
    guardarServicios();
    limpiarFormServicio();
    renderServiciosAdmin();
    
    alert('✅ Servicio actualizado correctamente.');
}

function eliminarServicio(id) {
    if (!confirm('¿Estás seguro de eliminar este servicio?')) return;
    
    servicios = servicios.filter(s => String(s.id) !== String(id));
    guardarServicios();
    renderServiciosAdmin();
    
    alert('✅ Servicio eliminado correctamente.');
}

// ================ EXPORTAR / IMPORTAR SERVICIOS ================

// Descargar servicios como archivo JSON (para actualizar servicios-iniciales.json en GitHub)
function descargarServiciosJSON() {
    if (!servicios.length) {
        alert('No hay servicios para exportar.');
        return;
    }
    
    // Ordenar servicios por ID para mantener consistencia
    const serviciosOrdenados = [...servicios].sort((a, b) => {
        const idA = Number(a.id) || 0;
        const idB = Number(b.id) || 0;
        return idA - idB;
    });
    
    const json = JSON.stringify(serviciosOrdenados, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'servicios-iniciales.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert(`✅ Archivo servicios-iniciales.json descargado con ${servicios.length} servicios.\n\n📝 Instrucciones:\n1. Sube este archivo a tu repositorio de GitHub\n2. Reemplaza el archivo servicios-iniciales.json existente\n3. Los cambios se verán en todos los dispositivos después de recargar`);
}

// Importar servicios desde JSON (desde textarea)
function importarServiciosJSON() {
    const area = document.getElementById('serviciosJsonArea');
    if (!area) return;

    if (area.style.display === 'none') {
        area.style.display = 'block';
        area.placeholder = 'Pega aquí el JSON de servicios y vuelve a pulsar "Importar servicios (JSON)".';
        area.focus();
        return;
    }

    const texto = area.value.trim();
    if (!texto) {
        alert('Pega primero el JSON en el cuadro.');
        return;
    }

    try {
        const lista = JSON.parse(texto);
        if (!Array.isArray(lista)) throw new Error('No es un array');
        if (!confirm('Esto reemplazará los servicios actuales. ¿Continuar?')) return;
        servicios = lista;
        guardarServicios();
        renderServiciosAdmin();
        // Re-renderizar en página de servicios si está abierta
        const page = document.body.dataset.page || '';
        if (page === 'servicios') {
            renderServicios();
            renderServiciosSolicitar();
        }
        alert('✅ Servicios importados correctamente.');
    } catch (e) {
        alert('El JSON no es válido: ' + e.message);
    }
}

// Importar servicios desde archivo JSON
function importarServiciosDesdeArchivo() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const archivo = e.target.files[0];
        if (!archivo) return;
        
        const lector = new FileReader();
        lector.onload = (event) => {
            try {
                const texto = event.target.result;
                const lista = JSON.parse(texto);
                if (!Array.isArray(lista)) throw new Error('El archivo no contiene un array válido');
                
                if (!confirm(`Se importarán ${lista.length} servicios. Esto reemplazará los servicios actuales. ¿Continuar?`)) {
                    return;
                }
                
                servicios = lista;
                guardarServicios();
                renderServiciosAdmin();
                
                // Re-renderizar en página de servicios si está abierta
                const page = document.body.dataset.page || '';
                if (page === 'servicios') {
                    renderServicios();
                    renderServiciosSolicitar();
                }
                
                alert(`✅ ${lista.length} servicios importados correctamente desde ${archivo.name}`);
            } catch (error) {
                alert('Error al importar el archivo: ' + error.message);
            }
        };
        lector.onerror = () => {
            alert('Error al leer el archivo.');
        };
        lector.readAsText(archivo);
    };
    input.click();
}

function limpiarFormServicio() {
    document.getElementById('servicioNombre').value = '';
    document.getElementById('servicioDescripcion').value = '';
    document.getElementById('servicioPrecio').value = '';
    document.getElementById('servicioImagen').value = '';
    
    // Limpiar editor de variantes
    pintarEditorVariantesServicio([]);
    
    const form = document.getElementById('formServicio');
    if (form) {
        delete form.dataset.editandoId;
    }
    
    const btnSubmit = form?.querySelector('button[type="submit"]');
    if (btnSubmit) {
        btnSubmit.textContent = '💾 Guardar Servicio';
    }
}

// ---------------- Ticket de venta / pedido ----------------
function formatearFechaCorta(fechaISO) {
    const f = new Date(fechaISO);
    if (Number.isNaN(f.getTime())) return '';
    return f.toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function generarHTMLTicket(venta) {
    const titulo = venta.tipo === 'fisica' ? 'TICKET DE VENTA FÍSICA' : 'TICKET DE PEDIDO WHATSAPP';
    const fechaTxt = formatearFechaCorta(venta.fecha);
    let filas = '';
    if (Array.isArray(venta.items)) {
        venta.items.forEach((item, idx) => {
            const varTxt = item.varianteNombre || item.variante || '';
            const tipoTxt = item.tipo === 'unidad'
                ? 'Unidad'
                : `Pack x${item.packCantidad || 0}`;
            filas += `
            <tr>
                <td>${idx + 1}</td>
                <td>${item.nombre}${varTxt ? ' (' + varTxt + ')' : ''}</td>
                <td>${tipoTxt}</td>
                <td style="text-align:right;">${item.cantidad}</td>
                <td style="text-align:right;">${formatoPrecio(item.precioUnitario)}</td>
                <td style="text-align:right;">${formatoPrecio(item.subtotal)}</td>
            </tr>`;
        });
    }
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    body{font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         padding:12px; font-size:12px;}
    h1{font-size:16px;margin:0 0 4px;}
    h2{font-size:13px;margin:4px 0;}
    table{width:100%;border-collapse:collapse;margin-top:6px;}
    th,td{border-bottom:1px solid #ddd;padding:3px 4px;font-size:11px;}
    th{text-align:left;background:#f5f5f5;}
    .tot{font-weight:bold;text-align:right;margin-top:8px;}
    .small{font-size:10px;color:#555;}
  </style>
</head>
<body>
  <h1>Tabloncito Digital</h1>
  <div class="small">El Tablón de Gómez - Nariño</div>
  <h2>${titulo}</h2>
  <div class="small">Fecha: ${fechaTxt}</div>
  <div class="small">ID: ${venta.id}</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Producto</th>
        <th>Tipo</th>
        <th>Cant</th>
        <th>Precio</th>
        <th>Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${filas}
    </tbody>
  </table>
  <div class="tot">TOTAL: ${formatoPrecio(venta.total || 0)}</div>
  <p class="small">Gracias por tu compra 💜</p>
</body>
</html>`;
}

function imprimirTicketDesdeObjeto(venta) {
    if (!venta) return;
    const html = generarHTMLTicket(venta);
    const win = window.open('', '_blank');
    if (!win) {
        alert('No se pudo abrir la ventana de impresión (puede estar bloqueada por el navegador).');
        return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
}

function imprimirTicketVentaPorId(id) {
    const venta = ventas.find(v => String(v.id) === String(id));
    if (!venta) {
        alert('No se encontró la venta para imprimir el ticket.');
        return;
    }
    imprimirTicketDesdeObjeto(venta);
}

function descargarTicketPDF(venta) {
    if (!venta) return;
    const html = generarHTMLTicket(venta);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fecha = new Date(venta.fecha);
    const tipoTxt = venta.tipo === 'fisica' ? 'venta' : 'pedido';
    a.download = `ticket_${tipoTxt}_${venta.id}_${fecha.getFullYear()}-${(fecha.getMonth()+1)
        .toString().padStart(2,'0')}-${fecha.getDate().toString().padStart(2,'0')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function mostrarOpcionesTicket(venta) {
    if (!venta) return;
    
    // Crear overlay modal
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '10000';
    
    const card = document.createElement('div');
    card.className = 'modal-card';
    card.style.maxWidth = '400px';
    
    const titulo = document.createElement('div');
    titulo.className = 'modal-titulo';
    titulo.textContent = venta.tipo === 'fisica' ? 'Venta registrada ✓' : 'Pedido enviado ✓';
    card.appendChild(titulo);
    
    const mensaje = document.createElement('div');
    mensaje.style.marginTop = '12px';
    mensaje.style.marginBottom = '20px';
    mensaje.style.color = '#666';
    mensaje.textContent = '¿Deseas imprimir o descargar el ticket?';
    card.appendChild(mensaje);
    
    const botones = document.createElement('div');
    botones.style.display = 'flex';
    botones.style.gap = '10px';
    botones.style.flexWrap = 'wrap';
    
    const btnImprimir = document.createElement('button');
    btnImprimir.className = 'btn btn-secondary';
    btnImprimir.textContent = '🖨️ Imprimir ticket';
    btnImprimir.addEventListener('click', () => {
        overlay.remove();
        imprimirTicketDesdeObjeto(venta);
    });
    
    const btnPDF = document.createElement('button');
    btnPDF.className = 'btn btn-secondary';
    btnPDF.textContent = '📄 Descargar HTML';
    btnPDF.addEventListener('click', () => {
        overlay.remove();
        descargarTicketPDF(venta);
    });
    
    const btnCerrar = document.createElement('button');
    btnCerrar.className = 'btn btn-secondary';
    btnCerrar.textContent = 'Cerrar';
    btnCerrar.addEventListener('click', () => overlay.remove());
    
    botones.appendChild(btnImprimir);
    botones.appendChild(btnPDF);
    botones.appendChild(btnCerrar);
    card.appendChild(botones);
    
    overlay.appendChild(card);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    
    document.body.appendChild(overlay);
}

function editarVentaPorId(id) {
    const venta = ventas.find(v => String(v.id) === String(id));
    if (!venta) {
        alert('No se encontró la venta para editar.');
        return;
    }
    
    if (!Array.isArray(venta.items) || !venta.items.length) {
        alert('Esta venta no tiene items para editar.');
        return;
    }
    
    // Crear overlay modal para editar
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '10000';
    
    const card = document.createElement('div');
    card.className = 'modal-card';
    card.style.maxWidth = '600px';
    card.style.maxHeight = '80vh';
    card.style.overflowY = 'auto';
    
    const titulo = document.createElement('div');
    titulo.className = 'modal-titulo';
    titulo.textContent = 'Editar venta';
    card.appendChild(titulo);
    
    const fechaTxt = formatearFechaCorta(venta.fecha);
    const fechaInfo = document.createElement('div');
    fechaInfo.style.marginTop = '8px';
    fechaInfo.style.marginBottom = '16px';
    fechaInfo.style.color = '#666';
    fechaInfo.style.fontSize = '0.9rem';
    fechaInfo.textContent = `Fecha: ${fechaTxt} | Tipo: ${venta.tipo === 'fisica' ? 'Venta física' : 'Pedido WhatsApp'}`;
    card.appendChild(fechaInfo);
    
    const form = document.createElement('div');
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '12px';
    
    const itemsEditados = [];
    venta.items.forEach((item, idx) => {
        const itemDiv = document.createElement('div');
        itemDiv.style.padding = '12px';
        itemDiv.style.border = '1px solid #e0e0e0';
        itemDiv.style.borderRadius = '8px';
        itemDiv.style.backgroundColor = '#f9f9f9';
        
        const nombre = document.createElement('div');
        nombre.style.fontWeight = 'bold';
        nombre.style.marginBottom = '8px';
        const varTxt = item.varianteNombre || item.variante || '';
        nombre.textContent = `${item.nombre}${varTxt ? ' (' + varTxt + ')' : ''}`;
        itemDiv.appendChild(nombre);
        
        const precioInfo = document.createElement('div');
        precioInfo.style.fontSize = '0.85rem';
        precioInfo.style.color = '#666';
        precioInfo.style.marginBottom = '8px';
        precioInfo.textContent = `Precio unitario: ${formatoPrecio(item.precioUnitario)}`;
        itemDiv.appendChild(precioInfo);
        
        const cantidadDiv = document.createElement('div');
        cantidadDiv.style.display = 'flex';
        cantidadDiv.style.alignItems = 'center';
        cantidadDiv.style.gap = '8px';
        
        const labelCant = document.createElement('label');
        labelCant.textContent = 'Cantidad:';
        labelCant.style.minWidth = '80px';
        cantidadDiv.appendChild(labelCant);
        
        const inputCant = document.createElement('input');
        inputCant.type = 'number';
        inputCant.min = '1';
        inputCant.value = item.cantidad;
        inputCant.style.flex = '1';
        inputCant.style.padding = '6px';
        inputCant.style.border = '1px solid #ddd';
        inputCant.style.borderRadius = '4px';
        inputCant.addEventListener('change', () => {
            const nuevaCant = Math.max(1, Number(inputCant.value) || 1);
            inputCant.value = nuevaCant;
            actualizarTotal();
        });
        cantidadDiv.appendChild(inputCant);
        
        itemDiv.appendChild(cantidadDiv);
        form.appendChild(itemDiv);
        
        itemsEditados.push({
            ...item,
            inputCantidad: inputCant
        });
    });
    
    card.appendChild(form);
    
    const totalDiv = document.createElement('div');
    totalDiv.style.marginTop = '16px';
    totalDiv.style.padding = '12px';
    totalDiv.style.backgroundColor = '#f0f0f0';
    totalDiv.style.borderRadius = '8px';
    totalDiv.style.fontWeight = 'bold';
    totalDiv.style.textAlign = 'right';
    
    const actualizarTotal = () => {
        let nuevoTotal = 0;
        itemsEditados.forEach(item => {
            const cant = Math.max(1, Number(item.inputCantidad.value) || 1);
            nuevoTotal += item.precioUnitario * cant;
        });
        totalDiv.textContent = `Total: ${formatoPrecio(nuevoTotal)}`;
    };
    actualizarTotal();
    
    card.appendChild(totalDiv);
    
    const botones = document.createElement('div');
    botones.style.display = 'flex';
    botones.style.gap = '10px';
    botones.style.marginTop = '20px';
    botones.style.justifyContent = 'flex-end';
    
    const btnCancelar = document.createElement('button');
    btnCancelar.className = 'btn btn-secondary';
    btnCancelar.textContent = 'Cancelar';
    btnCancelar.addEventListener('click', () => overlay.remove());
    
    const btnGuardar = document.createElement('button');
    btnGuardar.className = 'btn btn-primary';
    btnGuardar.textContent = 'Guardar cambios';
    btnGuardar.addEventListener('click', () => {
        // Si es venta física, necesitamos ajustar el stock
        if (venta.tipo === 'fisica') {
            // Primero restaurar el stock original (lo que se había descontado)
            venta.items.forEach(item => {
                const p = productos.find(prod => prod.id === item.idProducto);
                if (!p) return;
                
                const unidadesOriginales = item.tipo === 'unidad'
                    ? item.cantidad
                    : item.cantidad * (item.packCantidad || p.packCantidad || 0);
                
                const tieneVariantes = normalizarVariantes(p.variantes || []).length > 0;
                
                if (item.variante) {
                    const vars = normalizarVariantes(p.variantes || []);
                    const idxv = vars.findIndex(v => String(v.id) === String(item.variante));
                    if (idxv >= 0 && (vars[idxv].stock === 0 || vars[idxv].stock)) {
                        vars[idxv].stock = (Number(vars[idxv].stock) || 0) + unidadesOriginales;
                        p.variantes = vars;
                    }
                } else if (!tieneVariantes) {
                    // Solo restaurar stock del producto principal si NO tiene variantes
                    p.stock = (Number(p.stock) || 0) + unidadesOriginales;
                }
                
                // Restar de ventas
                if (p.ventas && p.ventas >= item.cantidad) {
                    p.ventas = (Number(p.ventas) || 0) - item.cantidad;
                }
            });
        }
        
        // Actualizar items de la venta con nuevas cantidades
        let nuevoTotal = 0;
        venta.items = itemsEditados.map(item => {
            const nuevaCant = Math.max(1, Number(item.inputCantidad.value) || 1);
            const subtotal = item.precioUnitario * nuevaCant;
            nuevoTotal += subtotal;
            return {
                ...item,
                cantidad: nuevaCant,
                subtotal: subtotal
            };
        });
        venta.total = nuevoTotal;
        
        // Si es venta física, descontar el nuevo stock
        if (venta.tipo === 'fisica') {
            venta.items.forEach(item => {
                const p = productos.find(prod => prod.id === item.idProducto);
                if (!p) return;
                
                const unidadesNuevas = item.tipo === 'unidad'
                    ? item.cantidad
                    : item.cantidad * (item.packCantidad || p.packCantidad || 0);
                
                const tieneVariantes = normalizarVariantes(p.variantes || []).length > 0;
                
                if (item.variante) {
                    const vars = normalizarVariantes(p.variantes || []);
                    const idxv = vars.findIndex(v => String(v.id) === String(item.variante));
                    if (idxv >= 0 && (vars[idxv].stock === 0 || vars[idxv].stock)) {
                        vars[idxv].stock = Math.max(0, (Number(vars[idxv].stock) || 0) - unidadesNuevas);
                        p.variantes = vars;
                    }
                } else if (!tieneVariantes) {
                    // Solo descontar del producto principal si NO tiene variantes
                    p.stock = Math.max(0, (Number(p.stock) || 0) - unidadesNuevas);
                }
                
                // Sumar a ventas
                p.ventas = (Number(p.ventas) || 0) + item.cantidad;
            });
            guardarProductos();
            renderInventarioTabla();
            renderListaProductosTienda();
            actualizarDashboard();
        }
        
        guardarVentas();
        renderVentas(ventasRangoActual || 'hoy');
        overlay.remove();
        alert('Venta actualizada correctamente' + (venta.tipo === 'fisica' ? ' y stock ajustado.' : '.'));
    });
    
    botones.appendChild(btnCancelar);
    botones.appendChild(btnGuardar);
    card.appendChild(botones);
    
    overlay.appendChild(card);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    
    document.body.appendChild(overlay);
}

function eliminarVentaPorId(id) {
    if (!confirm('¿Eliminar este registro del historial de ventas? Se restaurará el stock de los productos vendidos.')) return;
    
    const venta = ventas.find(v => String(v.id) === String(id));
    if (!venta) {
        alert('No se encontró la venta para eliminar.');
        return;
    }
    
    // Solo restaurar stock si es una venta física (no pedidos de WhatsApp)
    if (venta.tipo === 'fisica' && Array.isArray(venta.items)) {
        venta.items.forEach(item => {
            const p = productos.find(prod => prod.id === item.idProducto);
            if (!p) return;
            
            const unidadesRestaurar = item.tipo === 'unidad'
                ? item.cantidad
                : item.cantidad * (item.packCantidad || p.packCantidad || 0);
            
            const tieneVariantes = normalizarVariantes(p.variantes || []).length > 0;
            
            // Restaurar stock de variante si existe
            if (item.variante) {
                const vars = normalizarVariantes(p.variantes || []);
                const idxv = vars.findIndex(v => String(v.id) === String(item.variante));
                if (idxv >= 0 && (vars[idxv].stock === 0 || vars[idxv].stock)) {
                    vars[idxv].stock = (Number(vars[idxv].stock) || 0) + unidadesRestaurar;
                    p.variantes = vars;
                }
            } else if (!tieneVariantes) {
                // Solo restaurar stock del producto principal si NO tiene variantes
                p.stock = (Number(p.stock) || 0) + unidadesRestaurar;
            }
            
            // Restar de ventas si es posible
            if (p.ventas && p.ventas >= item.cantidad) {
                p.ventas = (Number(p.ventas) || 0) - item.cantidad;
            }
        });
        guardarProductos();
        renderInventarioTabla();
        renderListaProductosTienda();
        actualizarDashboard();
    }
    
    ventas = ventas.filter(v => String(v.id) !== String(id));
    guardarVentas();
    renderVentas(ventasRangoActual || 'hoy');
    alert('Venta eliminada' + (venta.tipo === 'fisica' ? ' y stock restaurado.' : '.'));
}

/* ============================================================
   ADMIN - BAJO INVENTARIO
============================================================ */
function productosBajoInventario(umbral = 5, categoriaFiltro = '') {
    const resultado = [];
    productos.forEach(p => {
        // Filtrar por categoría si se especifica
        if (categoriaFiltro && (p.categoria || '') !== categoriaFiltro) {
            return;
        }
        
        const tieneVariantes = normalizarVariantes(p.variantes || []).length > 0;
        
        // Solo contar stock del producto principal si NO tiene variantes
        if (!tieneVariantes) {
            const stockP = Number(p.stock) || 0;
            if (stockP > 0 && stockP <= umbral) {
                resultado.push({
                    nombre: p.nombre || '',
                    categoria: p.categoria || '',
                    stock: stockP,
                    idProducto: p.id
                });
            }
        }
        
        // Variantes con stock propio
        normalizarVariantes(p.variantes || []).forEach(v => {
            if (!(v.stock === 0 || v.stock)) return;
            const s = Number(v.stock) || 0;
            if (s > 0 && s <= umbral) {
                resultado.push({
                    nombre: `${p.nombre || ''} (${v.nombre})`,
                    categoria: p.categoria || '',
                    stock: s,
                    idProducto: p.id,
                    variante: v
                });
            }
        });
    });
    return resultado.sort((a, b) => {
        // Ordenar primero por categoría, luego por stock
        if (a.categoria !== b.categoria) {
            return (a.categoria || '').localeCompare(b.categoria || '', 'es', { sensitivity: 'base' });
        }
        return (Number(a.stock) || 0) - (Number(b.stock) || 0);
    });
}

function renderBajoInventario(umbral = 5, categoriaFiltro = '') {
    const tbody = document.getElementById('tablaBajoInventario');
    const vacio = document.getElementById('bajoInventarioVacio');
    if (!tbody || !vacio) return;

    const lista = productosBajoInventario(umbral, categoriaFiltro);
    tbody.innerHTML = '';

    if (!lista.length) {
        vacio.style.display = 'block';
        return;
    }
    vacio.style.display = 'none';

    let categoriaActual = '';
    lista.forEach(p => {
        // Agregar encabezado de categoría si cambia
        if (p.categoria !== categoriaActual) {
            categoriaActual = p.categoria || '';
            const trHeader = document.createElement('tr');
            trHeader.style.backgroundColor = '#f0f0f0';
            trHeader.style.fontWeight = 'bold';
            const tdHeader = document.createElement('td');
            tdHeader.colSpan = 3;
            tdHeader.textContent = `📂 ${categoriaActual || 'Sin categoría'}`;
            tdHeader.style.padding = '8px';
            trHeader.appendChild(tdHeader);
            tbody.appendChild(trHeader);
        }

        const tr = document.createElement('tr');
        const tdNombre = document.createElement('td');
        tdNombre.textContent = p.nombre || '';

        const tdCat = document.createElement('td');
        tdCat.textContent = p.categoria || '';

        const tdStock = document.createElement('td');
        tdStock.className = 'text-right';
        tdStock.textContent = Number(p.stock) || 0;

        tr.appendChild(tdNombre);
        tr.appendChild(tdCat);
        tr.appendChild(tdStock);
        tbody.appendChild(tr);
    });
    
    // Actualizar selector de categorías si existe
    actualizarSelectorCategoriasBajoStock();
}

function actualizarSelectorCategoriasBajoStock() {
    const select = document.getElementById('filtroCategoriaBajoStock');
    if (!select) return;
    
    const categorias = obtenerCategorias();
    const valorActual = select.value;
    
    select.innerHTML = '<option value="">Todas las categorías</option>';
    categorias.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });
    
    if (valorActual) {
        select.value = valorActual;
    }
}

// Exportar reporte de bajo stock en CSV para hacer pedidos
function exportarBajoStockCSV(umbral = 5, categoriaFiltro = '') {
    const lista = productosBajoInventario(umbral, categoriaFiltro);
    if (!lista.length) {
        alert('No hay productos con poco stock para exportar.');
        return;
    }
    const encabezado = 'nombre,categoria,stock\n';
    const filas = lista.map(p =>
        `"${(p.nombre || '').replace(/"/g, '""')}","${(p.categoria || '').replace(/"/g, '""')}",${Number(p.stock) || 0}`
    );
    const csv = encabezado + filas.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fecha = new Date();
    a.download = `bajo_stock_${fecha.getFullYear()}-${(fecha.getMonth()+1).toString().padStart(2,'0')}-${fecha.getDate().toString().padStart(2,'0')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Generar mensaje de WhatsApp para pedido de bajo stock
function generarMensajeWhatsAppBajoStock(umbral = 5, categoriaFiltro = '', stockObjetivo = 10) {
    const lista = productosBajoInventario(umbral, categoriaFiltro);
    if (!lista.length) {
        alert('No hay productos con poco stock para generar el pedido.');
        return '';
    }
    
    // Agrupar por categoría
    const productosPorCategoria = {};
    lista.forEach(p => {
        const cat = p.categoria || 'Sin categoría';
        if (!productosPorCategoria[cat]) {
            productosPorCategoria[cat] = [];
        }
        productosPorCategoria[cat].push(p);
    });
    
    // Generar mensaje ordenado
    let mensaje = '📦 *PEDIDO DE REPOSICIÓN DE STOCK*\n\n';
    mensaje += `Fecha: ${new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;
    mensaje += `Stock objetivo: ${stockObjetivo} unidades por producto\n\n`;
    mensaje += '━━━━━━━━━━━━━━━━━━━━\n\n';
    
    // Ordenar categorías alfabéticamente
    const categoriasOrdenadas = Object.keys(productosPorCategoria).sort((a, b) => 
        a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
    
    categoriasOrdenadas.forEach((categoria, idxCat) => {
        mensaje += `📂 *${categoria}*\n`;
        const productos = productosPorCategoria[categoria];
        
        productos.forEach((p, idx) => {
            const stockActual = Number(p.stock) || 0;
            const cantidadNecesaria = Math.max(0, stockObjetivo - stockActual);
            
            if (cantidadNecesaria > 0) {
                mensaje += `${idx + 1}. ${p.nombre}`;
                mensaje += `\n   Stock actual: ${stockActual}`;
                mensaje += `\n   Cantidad a pedir: *${cantidadNecesaria} unidades*\n`;
            }
        });
        
        if (idxCat < categoriasOrdenadas.length - 1) {
            mensaje += '\n';
        }
    });
    
    mensaje += '\n━━━━━━━━━━━━━━━━━━━━\n';
    mensaje += `Total de productos: ${lista.length}\n`;
    mensaje += '\nGracias! 🙏';
    
    return mensaje;
}

function enviarPedidoWhatsAppBajoStock() {
    const inputUmbral = document.getElementById('umbralBajoStock');
    const selectCategoria = document.getElementById('filtroCategoriaBajoStock');
    const inputStockObjetivo = document.getElementById('stockObjetivoBajoStock');
    
    if (!inputUmbral || !inputStockObjetivo) {
        alert('Error: No se encontraron los controles necesarios.');
        return;
    }
    
    const umbral = Number(inputUmbral.value) || 5;
    const categoriaFiltro = selectCategoria ? selectCategoria.value : '';
    const stockObjetivo = Number(inputStockObjetivo.value) || 10;
    
    if (stockObjetivo <= 0) {
        alert('El stock objetivo debe ser mayor a 0.');
        return;
    }
    
    const mensaje = generarMensajeWhatsAppBajoStock(umbral, categoriaFiltro, stockObjetivo);
    
    if (!mensaje) {
        return;
    }
    
    // Usar el mismo número que se usa para pedidos normales
    const numero = '573016520610';
    const url = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensaje);
    
    window.open(url, '_blank');
}

/* ============================================================
   ADMIN - EXPORTAR / IMPORTAR
============================================================ */
function exportarJSON() {
    const area = document.getElementById('jsonArea');
    if (!area) return;

    if (!productos.length) {
        alert('No hay productos para exportar.');
        return;
    }
    const json = JSON.stringify(productos, null, 2);
    area.style.display = 'block';
    area.value = json;
    area.focus();
    area.select();
    alert('JSON generado. Copia el contenido para guardarlo en un archivo de respaldo.');
}

// Variable para guardar el handle de los archivos HTML
let htmlFilesHandle = {
    tienda: null,
    tecnologia: null,
    producto: null,
    admin: null
};

// Función para actualizar JSON inline en archivos HTML
async function actualizarHTMLConJSONInline(productosOrdenados) {
    const jsonMinificado = JSON.stringify(productosOrdenados);
    const scriptTagContent = `    <script id="productos-iniciales-data" type="application/json">
${jsonMinificado}
    </script>`;
    
    const archivosHTML = [
        { nombre: 'tienda.html', handle: htmlFilesHandle.tienda },
        { nombre: 'tecnologia.html', handle: htmlFilesHandle.tecnologia },
        { nombre: 'producto.html', handle: htmlFilesHandle.producto },
        { nombre: 'admin.html', handle: htmlFilesHandle.admin }
    ];
    
    let archivosActualizados = 0;
    let archivosConError = [];
    
    for (const archivo of archivosHTML) {
        try {
            let contenido = '';
            
            // Si tenemos handle guardado, usar ese archivo
            if (archivo.handle) {
                const file = await archivo.handle.getFile();
                contenido = await file.text();
            } else {
                // Intentar leer el archivo desde el servidor
                try {
                    const response = await fetch(archivo.nombre);
                    if (response.ok) {
                        contenido = await response.text();
                    } else {
                        console.warn(`No se pudo leer ${archivo.nombre} desde el servidor`);
                        continue;
                    }
                } catch (e) {
                    console.warn(`Error al leer ${archivo.nombre}:`, e);
                    continue;
                }
            }
            
            // Buscar y reemplazar el script tag
            const regex = /<script id="productos-iniciales-data" type="application\/json">[\s\S]*?<\/script>/;
            
            if (regex.test(contenido)) {
                // Reemplazar contenido existente
                contenido = contenido.replace(regex, scriptTagContent);
            } else {
                // Si no existe, buscar donde insertarlo (antes de </head>)
                const headCloseRegex = /<\/head>/;
                if (headCloseRegex.test(contenido)) {
                    contenido = contenido.replace(headCloseRegex, scriptTagContent + '\n</head>');
                } else {
                    console.warn(`No se encontró </head> en ${archivo.nombre}`);
                    continue;
                }
            }
            
            // Si tenemos handle, escribir el archivo
            if (archivo.handle) {
                const writable = await archivo.handle.createWritable();
                await writable.write(contenido);
                await writable.close();
                archivosActualizados++;
                console.log(`✅ ${archivo.nombre} actualizado`);
            } else {
                // Descargar el archivo actualizado
                const blob = new Blob([contenido], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = archivo.nombre;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                archivosActualizados++;
                console.log(`✅ ${archivo.nombre} descargado (actualizado)`);
            }
        } catch (error) {
            console.error(`Error al actualizar ${archivo.nombre}:`, error);
            archivosConError.push(archivo.nombre);
        }
    }
    
    return { actualizados: archivosActualizados, errores: archivosConError };
}

// Función para seleccionar archivos HTML y guardar handles
async function seleccionarArchivosHTML() {
    if (!('showOpenFilePicker' in window)) {
        alert('Tu navegador no soporta la API de archivos. Los archivos HTML se descargarán automáticamente.');
        return false;
    }
    
    try {
        const archivos = [
            { nombre: 'tienda.html', handle: null },
            { nombre: 'tecnologia.html', handle: null },
            { nombre: 'producto.html', handle: null },
            { nombre: 'admin.html', handle: null }
        ];
        
        for (const archivo of archivos) {
            try {
                const [handle] = await window.showOpenFilePicker({
                    suggestedName: archivo.nombre,
                    types: [{
                        description: 'HTML files',
                        accept: { 'text/html': ['.html'] }
                    }],
                    multiple: false
                });
                
                if (handle.name === archivo.nombre || confirm(`¿Usar "${handle.name}" como ${archivo.nombre}?`)) {
                    htmlFilesHandle[archivo.nombre.replace('.html', '')] = handle;
                }
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.warn(`Error al seleccionar ${archivo.nombre}:`, e);
                }
            }
        }
        
        // Guardar handles en localStorage
        try {
            // Los handles no se pueden serializar, pero podemos guardar un flag
            localStorage.setItem('TD_HTML_FILES_SELECTED', 'true');
        } catch (e) {
            console.warn('No se pudo guardar en localStorage:', e);
        }
        
        return true;
    } catch (error) {
        console.error('Error al seleccionar archivos HTML:', error);
        return false;
    }
}

// Descargar productos como archivo JSON (para actualizar productos-iniciales.json en GitHub)
async function descargarProductosJSON() {
    if (!productos.length) {
        alert('No hay productos para exportar.');
        return;
    }
    
    // Ordenar productos por ID para mantener consistencia
    const productosOrdenados = [...productos].sort((a, b) => {
        const idA = Number(a.id) || 0;
        const idB = Number(b.id) || 0;
        return idA - idB;
    });
    
    const json = JSON.stringify(productosOrdenados, null, 2);
    const jsonMinificado = JSON.stringify(productosOrdenados); // Sin espacios para inline
    
    // Descargar archivo JSON normal
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'productos-iniciales.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Actualizar archivos HTML automáticamente
    console.log('🔄 Actualizando archivos HTML con JSON inline...');
    const resultado = await actualizarHTMLConJSONInline(productosOrdenados);
    
    if (resultado.actualizados > 0) {
        const mensaje = `✅ Archivo productos-iniciales.json descargado con ${productos.length} productos.\n\n✅ ${resultado.actualizados} archivo(s) HTML actualizado(s) automáticamente.\n\n${resultado.errores.length > 0 ? `⚠️ Errores en: ${resultado.errores.join(', ')}\n\n` : ''}📝 INSTRUCCIONES:\n\n1. Si los archivos HTML se descargaron, súbelos a GitHub reemplazando los existentes\n2. También sube el archivo productos-iniciales.json\n3. Los productos cargarán INSTANTÁNEAMENTE en la próxima visita\n\n💡 TIP: Para actualización automática sin descargas, selecciona los archivos HTML primero usando el botón "Seleccionar archivos HTML".`;
        alert(mensaje);
    } else {
        // Si no se pudieron actualizar automáticamente, copiar al portapapeles
        navigator.clipboard.writeText(`<script id="productos-iniciales-data" type="application/json">\n${jsonMinificado}\n</script>`).then(() => {
            alert(`✅ Archivo productos-iniciales.json descargado con ${productos.length} productos.\n\n📝 INSTRUCCIONES PARA CARGA INSTANTÁNEA:\n\n1. Abre tienda.html, tecnologia.html, producto.html y admin.html en un editor\n2. Busca el tag: <script id="productos-iniciales-data">\n3. Pega el JSON que ya está en tu portapapeles (reemplaza el contenido)\n4. Guarda y sube a GitHub\n\n⚡ Esto hará que los productos carguen INSTANTÁNEAMENTE sin esperar fetch HTTP.\n\nTambién puedes subir el archivo productos-iniciales.json normalmente.`);
        }).catch(() => {
            alert(`✅ Archivo productos-iniciales.json descargado con ${productos.length} productos.\n\n📝 Instrucciones:\n1. Sube este archivo a tu repositorio de GitHub\n2. Reemplaza el archivo productos-iniciales.json existente\n3. Los cambios se verán en todos los dispositivos después de recargar\n\n💡 TIP: Para carga aún más rápida, inyecta el JSON directamente en el HTML como script tag inline.`);
        });
    }
}

function importarJSON() {
    const area = document.getElementById('jsonArea');
    if (!area) return;

    if (area.style.display === 'none') {
        area.style.display = 'block';
        area.placeholder = 'Pega aquí el JSON de productos y vuelve a pulsar "Importar productos (JSON)".';
        area.focus();
        return;
    }

    const texto = area.value.trim();
    if (!texto) {
        alert('Pega primero el JSON en el cuadro.');
        return;
    }

    try {
        const lista = JSON.parse(texto);
        if (!Array.isArray(lista)) throw new Error('No es un array');
        if (!confirm('Esto reemplazará los productos actuales. ¿Continuar?')) return;
        productos = lista;
        guardarProductos();
        renderFiltrosCategoria();
        renderDatalistCategoriasAdmin();
        renderListaProductosTienda();
        renderInventarioTabla();
        actualizarDashboard();
        alert('Productos importados correctamente.');
    } catch (e) {
        alert('El JSON no es válido: ' + e.message);
    }
}

function borrarTodosLosProductos() {
    const area = document.getElementById('jsonArea');
    if (!productos.length) {
        alert('No hay productos para borrar.');
        return;
    }
    if (!confirm('Esta acción borrará TODOS los productos y vaciará el carrito. ¿Seguro?')) return;
    productos = [];
    carrito = [];
    guardarProductos(true); // Actualizar en GitHub
    guardarCarrito();
    renderFiltrosCategoria();
    renderDatalistCategoriasAdmin();
    renderListaProductosTienda();
    renderInventarioTabla();
    actualizarDashboard();
    if (area) area.value = '';
    alert('Inventario limpiado por completo.');
}

// Importar productos desde CSV (exportado por Excel)
function importarProductosDesdeCSV(archivo) {
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = (e) => {
        const texto = e.target.result;
        if (!texto) {
            alert('El archivo está vacío.');
            return;
        }
        // Separar por líneas
        const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lineas.length < 2) {
            alert('El CSV no tiene datos suficientes.');
            return;
        }
        const encabezado = lineas[0].toLowerCase().split(',');
        // Columnas esperadas (mínimo nombre, precioVenta, stock)
        const idxNombre = encabezado.indexOf('nombre');
        const idxDescripcion = encabezado.indexOf('descripcion');
        const idxCosto = encabezado.indexOf('costo');
        const idxPrecio = encabezado.indexOf('precioventa');
        const idxStock = encabezado.indexOf('stock');
        const idxCategoria = encabezado.indexOf('categoria');
        const idxSku = encabezado.indexOf('sku');
        const idxImagen = encabezado.indexOf('imagenprincipal');

        if (idxNombre === -1 || idxPrecio === -1 || idxStock === -1) {
            alert('El CSV debe tener al menos las columnas: nombre, precioVenta, stock');
            return;
        }

        const nuevos = [];
        for (let i = 1; i < lineas.length; i++) {
            const cols = lineas[i].split(',');
            if (!cols[idxNombre]) continue;
            const nombre = cols[idxNombre].trim();
            const descripcion = idxDescripcion >= 0 ? (cols[idxDescripcion] || '').trim() : '';
            const costo = idxCosto >= 0 ? Number(cols[idxCosto]) || 0 : 0;
            const precioVenta = Number(cols[idxPrecio]) || 0;
            const stock = Number(cols[idxStock]) || 0;
            const categoria = idxCategoria >= 0 ? (cols[idxCategoria] || '').trim() : '';
            const sku = idxSku >= 0 ? (cols[idxSku] || '').trim() : '';
            const imagenPrincipal = idxImagen >= 0 ? (cols[idxImagen] || '').trim() : '';

            if (!nombre || !precioVenta) continue;
            nuevos.push({
                id: Date.now() + i,
                nombre,
                descripcion,
                costo,
                precioVenta,
                precioAnterior: 0,
                packCantidad: 0,
                packPrecio: 0,
                stock,
                categoria,
                sku,
                imagenPrincipal,
                imagenesExtra: [],
                variantes: [],
                promoActiva: false,
                promoTexto: '',
                precioPromo: 0,
                etiquetaVerde: '',
                ventas: 0
            });
        }

        if (!nuevos.length) {
            alert('No se pudieron leer productos del CSV.');
            return;
        }

        if (!confirm(`Se van a agregar ${nuevos.length} productos desde el CSV.\nNo se borrarán los existentes. ¿Continuar?`)) {
            return;
        }

        productos = productos.concat(nuevos);
        guardarProductos();
        renderFiltrosCategoria();
        renderListaProductosTienda();
        renderInventarioTabla();
        actualizarDashboard();
        alert('Productos importados desde CSV correctamente.');
    };
    lector.readAsText(archivo, 'utf-8');
}

/* ============================================================
   ADMIN - LOGIN
============================================================ */
function actualizarVistaAdminLogin() {
    const adminPanel = document.getElementById('adminPanel');
    const loginSection = document.getElementById('adminLoginSection');
    if (!adminPanel || !loginSection) return;

    if (adminLogueado) {
        loginSection.style.display = 'none';
        adminPanel.style.display = 'block';
    } else {
        loginSection.style.display = 'block';
        adminPanel.style.display = 'none';
    }
}

function intentarLoginAdmin() {
    const userInput = document.getElementById('adminUserInput');
    const passInput = document.getElementById('adminPassInput');
    const errorEl = document.getElementById('adminLoginError');
    if (!userInput || !passInput || !errorEl) return;

    const user = userInput.value.trim();
    const pass = passInput.value.trim();

    if (user === ADMIN_CONFIG.usuario && pass === ADMIN_CONFIG.contraseña) {
        adminLogueado = true;
        localStorage.setItem(STORAGE_KEYS.adminLogged, 'true');
        errorEl.textContent = '';
        actualizarVistaAdminLogin();
    initVariantesEditorAdmin();
    renderInventarioTabla();
        actualizarDashboard();
    } else {
        errorEl.textContent = 'Usuario o contraseña incorrectos.';
    }
}

function cerrarSesionAdmin() {
    adminLogueado = false;
    localStorage.removeItem(STORAGE_KEYS.adminLogged);
    actualizarVistaAdminLogin();
}

/* ============================================================
   PRODUCTO DETALLE (producto.html)
============================================================ */
function obtenerParametroURL(nombre) {
    const params = new URLSearchParams(window.location.search);
    return params.get(nombre);
}

function renderProductoDetalle() {
    const contTitulo = document.getElementById('productoTituloDetalle');
    const contImagenPrincipal = document.getElementById('productoImagenPrincipal');
    const contThumbs = document.getElementById('productoThumbs');
    const contPrecioActual = document.getElementById('productoPrecioActual');
    const contPrecioAnterior = document.getElementById('productoPrecioAnterior');
    const contDescuento = document.getElementById('productoDescuento');
    const contBadges = document.getElementById('productoBadges');
    const contVentas = document.getElementById('productoVentas');
    const contStock = document.getElementById('productoStock');
    const contSku = document.getElementById('productoSku');
    const contCategoria = document.getElementById('productoCategoria');
    const contDescripcion = document.getElementById('productoDescripcion');
    const contVariantes = document.getElementById('variantesLista');
    const selectTipoVenta = document.getElementById('tipoVentaSelect');
    const btnAgregar = document.getElementById('btnAgregarCarritoDetalle');

    if (!contTitulo || !btnAgregar) return;

    const id = Number(obtenerParametroURL('id'));
    const p = productos.find(prod => Number(prod.id) === id);
    if (!p) {
        contTitulo.textContent = 'Producto no encontrado';
        btnAgregar.disabled = true;
        return;
    }

    // Título
    contTitulo.textContent = p.nombre || '';

    // Badges
    contBadges.innerHTML = '';
    if (p.etiquetaVerde) {
        const b1 = document.createElement('span');
        b1.className = 'badge-verde';
        b1.textContent = p.etiquetaVerde;
        contBadges.appendChild(b1);
    }
    if (p.promoActiva && p.promoTexto) {
        const b2 = document.createElement('span');
        b2.className = 'badge-naranja';
        b2.textContent = p.promoTexto;
        contBadges.appendChild(b2);
    }

    // Precios
    const precioBase = Number(p.precioVenta) || 0;
    const precioPromo = p.promoActiva && p.precioPromo ? Number(p.precioPromo) : precioBase;
    const precioAnterior = p.precioAnterior ? Number(p.precioAnterior) : (p.promoActiva ? precioBase : 0);

    contPrecioActual.textContent = formatoPrecio(precioPromo);

    if (precioAnterior && precioAnterior > precioPromo) {
        contPrecioAnterior.textContent = formatoPrecio(precioAnterior);
        const desc = Math.round(100 - (precioPromo * 100 / precioAnterior));
        contDescuento.textContent = `-${desc}%`;
    } else {
        contPrecioAnterior.textContent = '';
        contDescuento.textContent = '';
    }

    // Ventas - solo mostrar si es mayor que 0
    if (p.ventas && Number(p.ventas) > 0) {
        contVentas.textContent = `${p.ventas}+ ventas`;
    } else {
        contVentas.textContent = '';
    }

    // Stock, SKU, categoría
    // Solo mostrar stock del producto principal si NO tiene variantes
    const tieneVariantes = normalizarVariantes(p.variantes || []).length > 0;
    const stockPrincipal = Number(p.stock) || 0;
    
    if (!tieneVariantes) {
        if (stockPrincipal === 0) {
            contStock.innerHTML = '<span style="color:#f44336;font-weight:bold;">❌ Sin stock disponible</span>';
        } else {
            contStock.innerHTML = `<span style="color:#4caf50;font-weight:bold;">✅ Stock disponible: ${stockPrincipal} unidades</span>`;
        }
    } else {
        contStock.textContent = 'Selecciona una variante para ver el stock disponible';
    }
    contSku.textContent = p.sku || 'N/A';
    contCategoria.textContent = p.categoria || 'Sin categoría';
    contDescripcion.textContent = p.descripcion || 'Sin descripción.';

    // Imágenes
    const todasImagenes = [p.imagenPrincipal].concat(p.imagenesExtra || []).filter(Boolean);
    const urlPrincipal = normalizarRutaImagen(todasImagenes[0]);
    contImagenPrincipal.src = urlPrincipal;

    contThumbs.innerHTML = '';
    todasImagenes.forEach((url, index) => {
        const d = document.createElement('div');
        d.className = 'producto-thumb' + (index === 0 ? ' activo' : '');
        const im = document.createElement('img');
        im.src = normalizarRutaImagen(url);
        d.appendChild(im);
        d.addEventListener('click', () => {
            document.querySelectorAll('.producto-thumb').forEach(t => t.classList.remove('activo'));
            d.classList.add('activo');
            contImagenPrincipal.src = normalizarRutaImagen(url);
        });
        contThumbs.appendChild(d);
    });

    // Variantes
    contVariantes.innerHTML = '';
    let varianteSeleccionada = null;
    const variantesNorm = normalizarVariantes(p.variantes || []);
    variantesNorm.forEach((v, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'var-opcion' + (idx === 0 ? ' activa' : '');
        btn.textContent = v.nombre;
        if (idx === 0) varianteSeleccionada = v;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.var-opcion').forEach(x => x.classList.remove('activa'));
            btn.classList.add('activa');
            varianteSeleccionada = v;
            const tipoActual = selectTipoVenta.value || 'unidad';
            // Si el tipo actual es pack, siempre mostrar precio de pack
            if (tipoActual === 'pack') {
                const precioPack = Number(p.packPrecio) || 0;
                contPrecioActual.textContent = formatoPrecio(precioPack);
                contPrecioAnterior.textContent = '';
                contDescuento.textContent = '';
            } else {
                // Al seleccionar variante en modo unidad, actualizar precio
                // Si hay promoción activa, usar siempre el precio promocional
                const precioVar = Number(v.precio) || 0;
                const precioMostrar = p.promoActiva ? precioPromo : (precioVar > 0 ? precioVar : precioPromo);
                contPrecioActual.textContent = formatoPrecio(precioMostrar);
                if (precioAnterior && precioAnterior > precioMostrar) {
                    contPrecioAnterior.textContent = formatoPrecio(precioAnterior);
                    const desc = Math.round(100 - (precioMostrar * 100 / precioAnterior));
                    contDescuento.textContent = `-${desc}%`;
                } else {
                    contPrecioAnterior.textContent = '';
                    contDescuento.textContent = '';
                }
            }
            // Stock por variante si existe
            const stockVariante = Number(v.stock) || 0;
            if (v.stock === 0 || v.stock) {
                if (stockVariante === 0) {
                    contStock.innerHTML = '<span style="color:#f44336;font-weight:bold;">❌ Sin stock disponible (variante)</span>';
                } else {
                    contStock.innerHTML = `<span style="color:#4caf50;font-weight:bold;">✅ Stock disponible: ${stockVariante} unidades (variante)</span>`;
                }
            } else {
                // Si la variante no tiene stock propio, no mostrar stock del producto principal si hay variantes
                const tieneVariantes = normalizarVariantes(p.variantes || []).length > 0;
                if (!tieneVariantes) {
                    const stockPrincipal = Number(p.stock) || 0;
                    if (stockPrincipal === 0) {
                        contStock.innerHTML = '<span style="color:#f44336;font-weight:bold;">❌ Sin stock disponible</span>';
                    } else {
                        contStock.innerHTML = `<span style="color:#4caf50;font-weight:bold;">✅ Stock disponible: ${stockPrincipal} unidades</span>`;
                    }
                } else {
                    contStock.innerHTML = '<span style="color:#ff9800;">⚠️ Esta variante no tiene stock definido</span>';
                }
            }
        });
        contVariantes.appendChild(btn);
    });

    // Si la primera variante tiene precio propio, reflejarlo desde el inicio
    if (varianteSeleccionada && Number(varianteSeleccionada.precio) > 0) {
        const precioMostrar = Number(varianteSeleccionada.precio);
        contPrecioActual.textContent = formatoPrecio(precioMostrar);
        if (precioAnterior && precioAnterior > precioMostrar) {
            contPrecioAnterior.textContent = formatoPrecio(precioAnterior);
            const desc = Math.round(100 - (precioMostrar * 100 / precioAnterior));
            contDescuento.textContent = `-${desc}%`;
        } else {
            contPrecioAnterior.textContent = '';
            contDescuento.textContent = '';
        }
        // stock texto inicial si la variante tiene stock propio
        if (varianteSeleccionada.stock === 0 || varianteSeleccionada.stock) {
            const stockVar = Number(varianteSeleccionada.stock) || 0;
            if (stockVar === 0) {
                contStock.innerHTML = '<span style="color:#f44336;font-weight:bold;">❌ Sin stock disponible (variante)</span>';
            } else {
                contStock.innerHTML = `<span style="color:#4caf50;font-weight:bold;">✅ Stock disponible: ${stockVar} unidades (variante)</span>`;
            }
        }
    }

    // Tipo de venta
    selectTipoVenta.innerHTML = '';
    const optUnidad = document.createElement('option');
    optUnidad.value = 'unidad';
    optUnidad.textContent = 'Por unidad';
    selectTipoVenta.appendChild(optUnidad);

    if (p.packCantidad && p.packCantidad > 0 && p.packPrecio && p.packPrecio > 0) {
        const optPack = document.createElement('option');
        optPack.value = 'pack';
        optPack.textContent = `Pack x${p.packCantidad}`;
        selectTipoVenta.appendChild(optPack);
    }

    // Cuando cambia tipo de compra, actualizar el precio mostrado
    selectTipoVenta.addEventListener('change', () => {
        const tipo = selectTipoVenta.value || 'unidad';
        let precioMostrar;
        if (tipo === 'pack') {
            precioMostrar = Number(p.packPrecio) || 0;
            // Para pack no mostramos precio anterior ni descuento porque es otro tipo de cálculo
            contPrecioAnterior.textContent = '';
            contDescuento.textContent = '';
        } else {
            const precioBase = Number(p.precioVenta) || 0;
            const precioPromo = p.promoActiva && p.precioPromo ? Number(p.precioPromo) : precioBase;
            // Si hay promoción activa, usar siempre el precio promocional
            // Si no hay promoción, usar el precio de la variante si existe
            if (p.promoActiva) {
                precioMostrar = precioPromo;
            } else if (varianteSeleccionada && Number(varianteSeleccionada.precio) > 0) {
                precioMostrar = Number(varianteSeleccionada.precio);
            } else {
                precioMostrar = precioPromo;
            }
            if (precioAnterior && precioAnterior > precioMostrar) {
                contPrecioAnterior.textContent = formatoPrecio(precioAnterior);
                const desc = Math.round(100 - (precioMostrar * 100 / precioAnterior));
                contDescuento.textContent = `-${desc}%`;
            } else {
                contPrecioAnterior.textContent = '';
                contDescuento.textContent = '';
            }
        }
        contPrecioActual.textContent = formatoPrecio(precioMostrar);
    });

    // Función para verificar stock y actualizar botón
    const actualizarEstadoBotonDetalle = () => {
        const tipoVenta = selectTipoVenta.value || 'unidad';
        const cantidadInput = document.getElementById('cantidadDetalle');
        const cant = Number(cantidadInput.value) || 1;
        
        let stockDisponible = 0;
        const tieneVariantes = normalizarVariantes(p.variantes || []).length > 0;
        
        if (varianteSeleccionada && (varianteSeleccionada.stock === 0 || varianteSeleccionada.stock)) {
            stockDisponible = Number(varianteSeleccionada.stock) || 0;
        } else if (!tieneVariantes) {
            stockDisponible = Number(p.stock) || 0;
        }
        
        const unidadesNecesarias = tipoVenta === 'unidad' ? cant : cant * (p.packCantidad || 0);
        
        if (stockDisponible === 0 || unidadesNecesarias > stockDisponible) {
            btnAgregar.disabled = true;
            btnAgregar.style.opacity = '0.5';
            btnAgregar.style.cursor = 'not-allowed';
            btnAgregar.textContent = stockDisponible === 0 ? '❌ Sin stock' : '⚠️ Stock insuficiente';
        } else {
            btnAgregar.disabled = false;
            btnAgregar.style.opacity = '1';
            btnAgregar.style.cursor = 'pointer';
            btnAgregar.textContent = '🛒 Añadir al carrito';
        }
    };
    
    // Actualizar estado del botón cuando cambia cantidad, tipo o variante
    const cantidadInput = document.getElementById('cantidadDetalle');
    if (cantidadInput) {
        cantidadInput.addEventListener('input', actualizarEstadoBotonDetalle);
        cantidadInput.addEventListener('change', actualizarEstadoBotonDetalle);
    }
    selectTipoVenta.addEventListener('change', () => {
        // Actualizar precio (código existente)
        const tipo = selectTipoVenta.value || 'unidad';
        let precioMostrar;
        if (tipo === 'pack') {
            precioMostrar = Number(p.packPrecio) || 0;
            contPrecioAnterior.textContent = '';
            contDescuento.textContent = '';
        } else {
            const precioBase = Number(p.precioVenta) || 0;
            const precioPromo = p.promoActiva && p.precioPromo ? Number(p.precioPromo) : precioBase;
            if (p.promoActiva) {
                precioMostrar = precioPromo;
            } else if (varianteSeleccionada && Number(varianteSeleccionada.precio) > 0) {
                precioMostrar = Number(varianteSeleccionada.precio);
            } else {
                precioMostrar = precioPromo;
            }
            if (precioAnterior && precioAnterior > precioMostrar) {
                contPrecioAnterior.textContent = formatoPrecio(precioAnterior);
                const desc = Math.round(100 - (precioMostrar * 100 / precioAnterior));
                contDescuento.textContent = `-${desc}%`;
            } else {
                contPrecioAnterior.textContent = '';
                contDescuento.textContent = '';
            }
        }
        contPrecioActual.textContent = formatoPrecio(precioMostrar);
        actualizarEstadoBotonDetalle();
    });
    
    // Actualizar estado del botón cuando se selecciona variante
    contVariantes.querySelectorAll('.var-opcion').forEach(btn => {
        btn.addEventListener('click', () => {
            setTimeout(() => {
                actualizarEstadoBotonDetalle();
            }, 50);
        });
    });
    
    // Verificar estado inicial
    actualizarEstadoBotonDetalle();
    
    // Botón agregar
    btnAgregar.addEventListener('click', () => {
        const cantidadInput = document.getElementById('cantidadDetalle');
        const cant = Number(cantidadInput.value) || 1;
        if (cant <= 0) return;
        const tipoVenta = selectTipoVenta.value || 'unidad';
        
        // Verificar stock antes de agregar
        let stockDisponible = 0;
        const tieneVariantes = normalizarVariantes(p.variantes || []).length > 0;
        
        if (varianteSeleccionada && (varianteSeleccionada.stock === 0 || varianteSeleccionada.stock)) {
            stockDisponible = Number(varianteSeleccionada.stock) || 0;
        } else if (!tieneVariantes) {
            stockDisponible = Number(p.stock) || 0;
        }
        
        const unidadesNecesarias = tipoVenta === 'unidad' ? cant : cant * (p.packCantidad || 0);
        
        if (stockDisponible === 0) {
            alert('❌ Este producto no tiene stock disponible.');
            return;
        }
        
        if (unidadesNecesarias > stockDisponible) {
            alert(`⚠️ Stock insuficiente. Solo hay ${stockDisponible} unidades disponibles.`);
            return;
        }
        
        const agregado = agregarAlCarrito(p.id, tipoVenta, cant, varianteSeleccionada || null);
        if (agregado) {
            alert('✅ Producto agregado al carrito.');
            renderCarrito();
            actualizarEstadoBotonDetalle();
        }
    });
}

/* ============================================================
   INICIALIZACIÓN POR PÁGINA
============================================================ */
// Función para obtener información del espacio en localStorage
function obtenerInfoAlmacenamiento() {
    try {
        let total = 0;
        let usado = 0;
        
        // Calcular espacio usado
        for (let clave in localStorage) {
            if (localStorage.hasOwnProperty(clave)) {
                const valor = localStorage.getItem(clave);
                usado += valor ? valor.length + clave.length : 0;
            }
        }
        
        // Estimación del límite (típicamente 5-10MB dependiendo del navegador)
        total = 5 * 1024 * 1024; // 5MB como referencia
        
        return {
            usado: usado,
            total: total,
            porcentaje: (usado / total) * 100,
            disponible: total - usado
        };
    } catch (e) {
        return null;
    }
}

// Limpieza periódica cada 5 minutos
let intervaloLimpieza = null;

function iniciarLimpiezaPeriodica() {
    // Limpiar intervalo anterior si existe
    if (intervaloLimpieza) {
        clearInterval(intervaloLimpieza);
    }
    
    // Ejecutar limpieza cada 5 minutos
    intervaloLimpieza = setInterval(() => {
        mantenerLimpiezaAutomatica();
        const info = obtenerInfoAlmacenamiento();
        if (info && info.porcentaje > 80) {
            console.warn(`⚠️ Almacenamiento al ${info.porcentaje.toFixed(1)}% de capacidad. Limpieza automática activada.`);
        }
    }, 5 * 60 * 1000); // 5 minutos
}

document.addEventListener('DOMContentLoaded', async () => {
    const page = document.body.dataset.page || '';
    const anioFooter = document.getElementById('anioFooter');
    if (anioFooter) {
        anioFooter.textContent = new Date().getFullYear();
    }

    // Cargar datos INMEDIATAMENTE - sin delays
    await cargarDatos();
    
    // Intentar restaurar el handle del archivo de ventas si existe
    // Nota: Los handles no se pueden serializar, así que solo verificamos si está configurado
    // El usuario necesitará seleccionar el archivo nuevamente si recarga la página
    // Pero las ventas se descargarán automáticamente de todas formas
    
    // Iniciar limpieza periódica automática
    iniciarLimpiezaPeriodica();

    if (page === 'tienda' || page === 'tecnologia') {
        // Renderizar filtros y carrito inmediatamente (no dependen de productos)
        renderFiltrosCategoria();
        renderCarrito();
        
        // Renderizar productos INMEDIATAMENTE después de cargar datos
        // Si hay productos en localStorage, aparecerán al instante
        // Si no hay productos, se mostrarán cuando lleguen del JSON
        renderListaProductosTienda();
        
        // Ocultar overlay si estaba visible (ya se cargaron los datos)
        ocultarLoadingOverlay();

        const filtroBusqueda = document.getElementById('filtroBusqueda');
        const filtroCategoria = document.getElementById('filtroCategoria');
        const filtroOrden = document.getElementById('filtroOrden');
        if (filtroBusqueda) filtroBusqueda.addEventListener('input', renderListaProductosTienda);
        if (filtroBusqueda) {
            filtroBusqueda.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const codigo = filtroBusqueda.value.trim();
                    if (!codigo) return;
                    const ok = buscarYAgregarPorCodigo(codigo);
                    if (ok) {
                        filtroBusqueda.value = '';
                        renderCarrito();
                        alert('Producto agregado al carrito por código.');
                    } else {
                        alert('No se encontró ningún producto o variante con ese código.');
                    }
                }
            });
        }
        if (filtroCategoria) filtroCategoria.addEventListener('change', renderListaProductosTienda);
        if (filtroOrden) filtroOrden.addEventListener('change', renderListaProductosTienda);

        const btnVaciarCarrito = document.getElementById('btnVaciarCarrito');
        const btnVentaFisica = document.getElementById('btnVentaFisica');
        // Mostrar/ocultar acciones de admin según login
        if (btnVentaFisica) {
            if (!adminLogueado) {
                btnVentaFisica.style.display = 'none';
            } else {
                btnVentaFisica.style.display = 'inline-flex';
            }
        }

        const btnWhatsApp = document.getElementById('btnPedidoWhatsApp');
        if (btnVaciarCarrito) btnVaciarCarrito.addEventListener('click', vaciarCarrito);
        if (btnVentaFisica) btnVentaFisica.addEventListener('click', registrarVentaFisica);
        if (btnWhatsApp) btnWhatsApp.addEventListener('click', enviarPedidoWhatsApp);

        // Barra superior de admin en tienda
        const adminBar = document.getElementById('adminBar');
        const btnLogoutAdminTop = document.getElementById('btnLogoutAdminTop');
        if (adminBar) {
            adminBar.style.display = adminLogueado ? 'inline-flex' : 'none';
        }
        if (btnLogoutAdminTop) {
            btnLogoutAdminTop.addEventListener('click', () => {
                cerrarSesionAdmin();
                // Refrescar la vista de tienda al cerrar sesión
                if (btnVentaFisica) {
                    btnVentaFisica.style.display = 'none';
                }
                if (adminBar) {
                    adminBar.style.display = 'none';
                }
            });
        }

        // Botón flotante carrito (abre modal con resumen)
        const fabCarrito = document.getElementById('fabCarrito');
        if (fabCarrito) {
            fabCarrito.addEventListener('click', abrirModalCarrito);
        }
    }

    if (page === 'admin') {
        actualizarVistaAdminLogin();

        if (adminLogueado) {
            renderInventarioTabla();
            actualizarDashboard();
            initVariantesEditorAdmin();
            renderFiltrosCategoria();
            renderDatalistCategoriasAdmin();
            renderVentas('hoy');
            renderBajoInventario();
            
            // Cargar configuración de GitHub en el formulario
            cargarConfigGitHubEnFormulario();
            
            // Event listeners para selección de archivo local
            const btnSeleccionarArchivo = document.getElementById('btnSeleccionarArchivo');
            if (btnSeleccionarArchivo) {
                btnSeleccionarArchivo.addEventListener('click', async () => {
                    const exito = await solicitarAccesoArchivoLocal();
                    if (exito) {
                        alert('✅ Archivo conectado correctamente. Ahora se actualizará automáticamente al guardar productos.');
                    }
                });
            }
            
            // Mostrar estado inicial del archivo
            if (archivoHandle) {
                actualizarEstadoArchivo(true, archivoHandle.name);
            } else {
                actualizarEstadoArchivo(false);
            }
            
            // Event listeners para configuración de GitHub
            const githubConfigForm = document.getElementById('githubConfigForm');
            if (githubConfigForm) {
                githubConfigForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    guardarConfigGitHubDesdeFormulario();
                });
            }
            
            const btnTestGitHub = document.getElementById('btnTestGitHub');
            if (btnTestGitHub) {
                btnTestGitHub.addEventListener('click', () => {
                    probarConexionGitHub();
                });
            }
        }

        const formLogin = document.getElementById('adminLoginForm');
        if (formLogin) {
            formLogin.addEventListener('submit', (e) => {
                e.preventDefault();
                intentarLoginAdmin();
            });
        }

        const passInput = document.getElementById('adminPassInput');
        if (passInput) {
            passInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    intentarLoginAdmin();
                }
            });
        }

        const btnLogout = document.getElementById('btnLogoutAdmin');
        if (btnLogout) {
            btnLogout.addEventListener('click', cerrarSesionAdmin);
        }

        const formProducto = document.getElementById('formProducto');
        if (formProducto) {
            formProducto.addEventListener('submit', guardarProductoDesdeFormulario);
        }
        const btnLimpiar = document.getElementById('btnLimpiarFormulario');
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', limpiarFormularioProducto);
        }
        const btnExportar = document.getElementById('btnExportarJSON');
        const btnDescargar = document.getElementById('btnDescargarJSON');
        const btnImportar = document.getElementById('btnImportarJSON');
        const btnImportarCSV = document.getElementById('btnImportarCSV');
        const inputCSV = document.getElementById('inputCSVProductos');
        const btnBorrarTodo = document.getElementById('btnBorrarTodo');
        if (btnExportar) btnExportar.addEventListener('click', exportarJSON);
        if (btnDescargar) btnDescargar.addEventListener('click', descargarProductosJSON);
        if (btnImportar) btnImportar.addEventListener('click', importarJSON);
        
        // Botón para seleccionar archivos HTML
        const btnSeleccionarHTML = document.getElementById('btnSeleccionarHTML');
        if (btnSeleccionarHTML) {
            btnSeleccionarHTML.addEventListener('click', async () => {
                const seleccionados = await seleccionarArchivosHTML();
                if (seleccionados) {
                    alert('✅ Archivos HTML seleccionados. Ahora cuando descargues productos, se actualizarán automáticamente.');
                }
            });
        }
        if (btnImportarCSV && inputCSV) {
            btnImportarCSV.addEventListener('click', () => inputCSV.click());
            inputCSV.addEventListener('change', () => {
                const archivo = inputCSV.files && inputCSV.files[0];
                importarProductosDesdeCSV(archivo);
                inputCSV.value = '';
            });
        }
        if (btnBorrarTodo) btnBorrarTodo.addEventListener('click', borrarTodosLosProductos);

        const buscarCodigoInput = document.getElementById('buscarCodigo');
        if (buscarCodigoInput) {
            buscarCodigoInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const codigo = buscarCodigoInput.value.trim();
                    buscarProductoPorCodigo(codigo);
                    buscarCodigoInput.value = '';
                }
            });
        }

        // Buscar por nombre en inventario
        const buscarNombreInput = document.getElementById('buscarNombreInventario');
        const btnLimpiarBusquedaNombre = document.getElementById('btnLimpiarBusquedaNombre');
        if (buscarNombreInput) {
            buscarNombreInput.addEventListener('input', renderInventarioTabla);
            buscarNombreInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    renderInventarioTabla();
                    // Si hay un único resultado, cargarlo directo al formulario
                    const q = buscarNombreInput.value.trim().toLowerCase();
                    if (!q) return;
                    const coincidencias = productos.filter(p => (p.nombre || '').toLowerCase().includes(q));
                    if (coincidencias.length === 1) {
                        cargarProductoEnFormulario(coincidencias[0].id);
                    }
                }
            });
        }
        if (btnLimpiarBusquedaNombre && buscarNombreInput) {
            btnLimpiarBusquedaNombre.addEventListener('click', () => {
                buscarNombreInput.value = '';
                renderInventarioTabla();
            });
        }

        // Tabs de la columna derecha (inventario / ventas / bajo stock / créditos)
        const tabButtons = document.querySelectorAll('.admin-tab-btn');
        const tabContents = document.querySelectorAll('.admin-tab-content');
        if (tabButtons.length && tabContents.length) {
            tabButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const tab = btn.dataset.adminTab;
                    tabButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    tabContents.forEach(c => {
                        const target = c.dataset.adminTabContent;
                        c.style.display = (target === tab) ? 'block' : 'none';
                    });
                    
                    // Si se abre la pestaña de créditos, renderizar
                    if (tab === 'creditos') {
                        renderCreditos();
                        actualizarEstadisticasCreditos();
                    }
                    
                    // Si se abre la pestaña de tareas, renderizar
                    if (tab === 'tareas') {
                        renderTareas();
                        actualizarEstadisticasTareas();
                        iniciarCountdownTareas();
                    }
                    
                    // Si se abre la pestaña de servicios, renderizar
                    if (tab === 'servicios') {
                        renderServiciosAdmin();
                        initVariantesEditorServicioAdmin();
                    }
                });
            });
        }
        
        // Gestión de créditos
        const formCredito = document.getElementById('formCredito');
        if (formCredito) {
            formCredito.addEventListener('submit', (e) => {
                e.preventDefault();
                const submitBtn = formCredito.querySelector('button[type="submit"]');
                const editingId = submitBtn.dataset.editingId;
                
                if (editingId) {
                    actualizarCredito(editingId);
                } else {
                    agregarCredito();
                }
            });
            
            // Establecer fecha por defecto
            const fechaInput = document.getElementById('creditoFecha');
            if (fechaInput && !fechaInput.value) {
                fechaInput.value = new Date().toISOString().split('T')[0];
            }
        }
        
        const btnLimpiarFormCredito = document.getElementById('btnLimpiarFormCredito');
        if (btnLimpiarFormCredito) {
            btnLimpiarFormCredito.addEventListener('click', limpiarFormCredito);
        }
        
        const btnCreditosTodos = document.getElementById('btnCreditosTodos');
        const btnCreditosPendientes = document.getElementById('btnCreditosPendientes');
        const btnCreditosPagados = document.getElementById('btnCreditosPagados');
        const filtroCreditosBusqueda = document.getElementById('filtroCreditosBusqueda');
        
        if (btnCreditosTodos) {
            btnCreditosTodos.addEventListener('click', () => {
                creditosFiltroActual = 'todos';
                btnCreditosTodos.classList.add('active');
                btnCreditosPendientes?.classList.remove('active');
                btnCreditosPagados?.classList.remove('active');
                renderCreditos();
            });
        }
        
        if (btnCreditosPendientes) {
            btnCreditosPendientes.addEventListener('click', () => {
                creditosFiltroActual = 'pendientes';
                btnCreditosTodos?.classList.remove('active');
                btnCreditosPendientes.classList.add('active');
                btnCreditosPagados?.classList.remove('active');
                renderCreditos();
            });
        }
        
        if (btnCreditosPagados) {
            btnCreditosPagados.addEventListener('click', () => {
                creditosFiltroActual = 'pagados';
                btnCreditosTodos?.classList.remove('active');
                btnCreditosPendientes?.classList.remove('active');
                btnCreditosPagados.classList.add('active');
                renderCreditos();
            });
        }
        
        if (filtroCreditosBusqueda) {
            filtroCreditosBusqueda.addEventListener('input', renderCreditos);
        }
        
        const btnExportarCreditos = document.getElementById('btnExportarCreditos');
        if (btnExportarCreditos) {
            btnExportarCreditos.addEventListener('click', exportarCreditos);
        }
        
        const btnConfigurarGuardadoCreditos = document.getElementById('btnConfigurarGuardadoCreditos');
        if (btnConfigurarGuardadoCreditos) {
            btnConfigurarGuardadoCreditos.addEventListener('click', configurarGuardadoAutomaticoCreditos);
            // Mostrar estado del guardado automático
            const estaConfigurado = localStorage.getItem(STORAGE_KEYS.creditosFileHandle) === 'configurado';
            if (estaConfigurado) {
                btnConfigurarGuardadoCreditos.textContent = '✅ Guardado automático activo';
                btnConfigurarGuardadoCreditos.classList.add('btn-success');
                btnConfigurarGuardadoCreditos.classList.remove('btn-primary');
            }
        }
        
        // Gestión de tareas
        const formTarea = document.getElementById('formTarea');
        if (formTarea) {
            formTarea.addEventListener('submit', (e) => {
                e.preventDefault();
                const submitBtn = formTarea.querySelector('button[type="submit"]');
                const editingId = submitBtn.dataset.editingId;
                
                if (editingId) {
                    actualizarTarea(editingId);
                } else {
                    agregarTarea();
                }
            });
            
            // Establecer fecha/hora por defecto (1 hora desde ahora)
            const fechaInput = document.getElementById('tareaFechaEntrega');
            if (fechaInput && !fechaInput.value) {
                const ahora = new Date();
                ahora.setHours(ahora.getHours() + 1);
                fechaInput.value = ahora.toISOString().slice(0, 16);
            }
        }
        
        const btnLimpiarFormTarea = document.getElementById('btnLimpiarFormTarea');
        if (btnLimpiarFormTarea) {
            btnLimpiarFormTarea.addEventListener('click', limpiarFormTarea);
        }
        
        const btnTareasTodas = document.getElementById('btnTareasTodas');
        const btnTareasPendientes = document.getElementById('btnTareasPendientes');
        const btnTareasCompletadas = document.getElementById('btnTareasCompletadas');
        const btnTareasPagadas = document.getElementById('btnTareasPagadas');
        const filtroTareasBusqueda = document.getElementById('filtroTareasBusqueda');
        
        if (btnTareasTodas) {
            btnTareasTodas.addEventListener('click', () => {
                tareasFiltroActual = 'todas';
                btnTareasTodas.classList.add('active');
                btnTareasPendientes?.classList.remove('active');
                btnTareasCompletadas?.classList.remove('active');
                btnTareasPagadas?.classList.remove('active');
                renderTareas();
            });
        }
        
        if (btnTareasPendientes) {
            btnTareasPendientes.addEventListener('click', () => {
                tareasFiltroActual = 'pendientes';
                btnTareasTodas?.classList.remove('active');
                btnTareasPendientes.classList.add('active');
                btnTareasCompletadas?.classList.remove('active');
                btnTareasPagadas?.classList.remove('active');
                renderTareas();
            });
        }
        
        if (btnTareasCompletadas) {
            btnTareasCompletadas.addEventListener('click', () => {
                tareasFiltroActual = 'completadas';
                btnTareasTodas?.classList.remove('active');
                btnTareasPendientes?.classList.remove('active');
                btnTareasCompletadas.classList.add('active');
                btnTareasPagadas?.classList.remove('active');
                renderTareas();
            });
        }
        
        if (btnTareasPagadas) {
            btnTareasPagadas.addEventListener('click', () => {
                tareasFiltroActual = 'pagadas';
                btnTareasTodas?.classList.remove('active');
                btnTareasPendientes?.classList.remove('active');
                btnTareasCompletadas?.classList.remove('active');
                btnTareasPagadas.classList.add('active');
                renderTareas();
            });
        }
        
        if (filtroTareasBusqueda) {
            filtroTareasBusqueda.addEventListener('input', renderTareas);
        }
        
        const btnExportarTareas = document.getElementById('btnExportarTareas');
        if (btnExportarTareas) {
            btnExportarTareas.addEventListener('click', exportarTareas);
        }
        
        const btnConfigurarGuardadoTareas = document.getElementById('btnConfigurarGuardadoTareas');
        if (btnConfigurarGuardadoTareas) {
            btnConfigurarGuardadoTareas.addEventListener('click', configurarGuardadoAutomaticoTareas);
            // Mostrar estado del guardado automático
            const estaConfigurado = localStorage.getItem(STORAGE_KEYS.tareasFileHandle) === 'configurado';
            if (estaConfigurado) {
                btnConfigurarGuardadoTareas.textContent = '✅ Guardado automático activo';
                btnConfigurarGuardadoTareas.classList.add('btn-success');
                btnConfigurarGuardadoTareas.classList.remove('btn-primary');
            }
        }
        
        // Inicializar créditos si estamos en admin
        if (page === 'admin') {
            renderCreditos();
            actualizarEstadisticasCreditos();
            renderTareas();
            actualizarEstadisticasTareas();
        }

        // Eventos para reportes de ventas
        const btnVentasHoy = document.getElementById('btnVentasHoy');
        const btnVentas7Dias = document.getElementById('btnVentas7Dias');
        const btnVentasTodo = document.getElementById('btnVentasTodo');
        const btnExportarVentas = document.getElementById('btnExportarVentas');
        const btnBorrarHistorial = document.getElementById('btnBorrarHistorialVentas');
        if (btnVentasHoy) btnVentasHoy.addEventListener('click', () => renderVentas('hoy'));
        if (btnVentas7Dias) btnVentas7Dias.addEventListener('click', () => renderVentas('7dias'));
        if (btnVentasTodo) btnVentasTodo.addEventListener('click', () => renderVentas('todo'));
        if (btnExportarVentas) btnExportarVentas.addEventListener('click', exportarVentasJSON);
        if (btnBorrarHistorial) btnBorrarHistorial.addEventListener('click', borrarTodasLasVentas);
        
        // Selectores de fecha, mes y año
        const inputFechaVentas = document.getElementById('inputFechaVentas');
        const btnVentasPorFecha = document.getElementById('btnVentasPorFecha');
        if (btnVentasPorFecha && inputFechaVentas) {
            btnVentasPorFecha.addEventListener('click', () => {
                const fecha = inputFechaVentas.value;
                if (!fecha) {
                    alert('Por favor selecciona una fecha.');
                    return;
                }
                renderVentas('dia', fecha);
            });
            // También permitir Enter en el input
            inputFechaVentas.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    btnVentasPorFecha.click();
                }
            });
        }
        
        const inputMesVentas = document.getElementById('inputMesVentas');
        const btnVentasPorMes = document.getElementById('btnVentasPorMes');
        if (btnVentasPorMes && inputMesVentas) {
            btnVentasPorMes.addEventListener('click', () => {
                const mes = inputMesVentas.value;
                if (!mes) {
                    alert('Por favor selecciona un mes.');
                    return;
                }
                renderVentas('mes', mes);
            });
            // También permitir Enter en el input
            inputMesVentas.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    btnVentasPorMes.click();
                }
            });
        }
        
        const inputAnioVentas = document.getElementById('inputAnioVentas');
        const btnVentasPorAnio = document.getElementById('btnVentasPorAnio');
        if (btnVentasPorAnio && inputAnioVentas) {
            btnVentasPorAnio.addEventListener('click', () => {
                const anio = inputAnioVentas.value.trim();
                if (!anio || anio.length !== 4) {
                    alert('Por favor ingresa un año válido (4 dígitos, ej: 2024).');
                    return;
                }
                renderVentas('anio', anio);
            });
            // También permitir Enter en el input
            inputAnioVentas.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    btnVentasPorAnio.click();
                }
            });
        }
        
        // Establecer valores por defecto en los inputs
        if (inputFechaVentas) {
            const hoy = new Date();
            const fechaHoy = hoy.toISOString().split('T')[0];
            inputFechaVentas.value = fechaHoy;
        }
        if (inputMesVentas) {
            const hoy = new Date();
            const mesHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
            inputMesVentas.value = mesHoy;
        }
        if (inputAnioVentas) {
            inputAnioVentas.value = new Date().getFullYear();
        }
        
        const btnImportarVentas = document.getElementById('btnImportarVentas');
        if (btnImportarVentas) btnImportarVentas.addEventListener('click', importarVentasDesdeArchivo);
        
        const btnRecuperarVentasPerdidas = document.getElementById('btnRecuperarVentasPerdidas');
        if (btnRecuperarVentasPerdidas) btnRecuperarVentasPerdidas.addEventListener('click', recuperarVentasPerdidas);
        
        const btnConfigurarGuardadoVentas = document.getElementById('btnConfigurarGuardadoVentas');
        if (btnConfigurarGuardadoVentas) {
            btnConfigurarGuardadoVentas.addEventListener('click', configurarGuardadoAutomaticoVentas);
            // Mostrar estado del guardado automático
            const estaConfigurado = localStorage.getItem(STORAGE_KEYS.ventasFileHandle) === 'configurado';
            if (estaConfigurado) {
                btnConfigurarGuardadoVentas.textContent = '✅ Guardado automático activo';
                btnConfigurarGuardadoVentas.classList.add('btn-success');
                btnConfigurarGuardadoVentas.classList.remove('btn-primary');
            }
        }
        if (btnBorrarHistorial) btnBorrarHistorial.addEventListener('click', borrarTodasLasVentas);

        const inputUmbral = document.getElementById('umbralBajoStock');
        const btnUmbral = document.getElementById('btnAplicarUmbralBajoStock');
        const btnExportarBajoStock = document.getElementById('btnExportarBajoStock');
        const selectCategoriaBajoStock = document.getElementById('filtroCategoriaBajoStock');
        const btnWhatsAppBajoStock = document.getElementById('btnWhatsAppBajoStock');
        
        // Función para actualizar la vista de bajo stock
        const actualizarVistaBajoStock = () => {
            const u = Number(inputUmbral.value) || 5;
            const categoria = selectCategoriaBajoStock ? selectCategoriaBajoStock.value : '';
            renderBajoInventario(u, categoria);
        };
        
        if (btnUmbral && inputUmbral) {
            btnUmbral.addEventListener('click', actualizarVistaBajoStock);
        }
        
        if (selectCategoriaBajoStock) {
            selectCategoriaBajoStock.addEventListener('change', actualizarVistaBajoStock);
            // Inicializar el selector de categorías
            actualizarSelectorCategoriasBajoStock();
        }
        
        if (btnExportarBajoStock && inputUmbral) {
            btnExportarBajoStock.addEventListener('click', () => {
                const u = Number(inputUmbral.value) || 5;
                const categoria = selectCategoriaBajoStock ? selectCategoriaBajoStock.value : '';
                exportarBajoStockCSV(u, categoria);
            });
        }
        
        if (btnWhatsAppBajoStock) {
            btnWhatsAppBajoStock.addEventListener('click', enviarPedidoWhatsAppBajoStock);
        }
        
        // Inicializar vista de bajo stock al cargar
        if (inputUmbral) {
            actualizarVistaBajoStock();
        }

        // Imagen desde archivo -> convierte a dataURL y la guarda en el input de URL
        const inputImgArchivo = document.getElementById('imagenArchivoProducto');
        const inputImgUrl = document.getElementById('imagenPrincipalProducto');
        if (inputImgArchivo && inputImgUrl) {
            inputImgArchivo.addEventListener('change', () => {
                const file = inputImgArchivo.files && inputImgArchivo.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target.result;
                    if (typeof dataUrl === 'string') {
                        inputImgUrl.value = dataUrl;
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    }

    if (page === 'producto') {
        renderProductoDetalle();
        renderCarrito();

        const btnVaciarCarrito = document.getElementById('btnVaciarCarrito');
        const btnVentaFisica = document.getElementById('btnVentaFisica');
        const btnWhatsApp = document.getElementById('btnPedidoWhatsApp');
        // Solo mostrar venta física si es admin
        if (btnVentaFisica) {
            if (!adminLogueado) {
                btnVentaFisica.style.display = 'none';
            } else {
                btnVentaFisica.style.display = 'inline-flex';
            }
        }
        if (btnVaciarCarrito) btnVaciarCarrito.addEventListener('click', vaciarCarrito);
        if (btnVentaFisica) btnVentaFisica.addEventListener('click', registrarVentaFisica);
        if (btnWhatsApp) btnWhatsApp.addEventListener('click', enviarPedidoWhatsApp);

        // Botón flotante carrito (abre modal con resumen)
        const fabCarrito = document.getElementById('fabCarrito');
        if (fabCarrito) {
            fabCarrito.addEventListener('click', abrirModalCarrito);
        }
    }

    if (page === 'servicios') {
        renderServicios();
        renderServiciosSolicitar();
        
        // Tabs de servicios
        const tabButtons = document.querySelectorAll('.servicio-tab-btn');
        const tabContents = document.querySelectorAll('.servicio-tab-content');
        if (tabButtons.length && tabContents.length) {
            tabButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const tab = btn.dataset.servicioTab;
                    tabButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    tabContents.forEach(c => {
                        const target = c.id;
                        if (target === 'tabVerServicios' && tab === 'ver') {
                            c.style.display = 'block';
                        } else if (target === 'tabSolicitarServicio' && tab === 'solicitar') {
                            c.style.display = 'block';
                            renderServiciosSolicitar(); // Re-renderizar al cambiar de tab
                        } else {
                            c.style.display = 'none';
                        }
                    });
                });
            });
        }
    }
    
    // Gestión de servicios en admin
    const formServicio = document.getElementById('formServicio');
    if (formServicio) {
        formServicio.addEventListener('submit', (e) => {
            e.preventDefault();
            const form = e.target;
            const editingId = form.dataset.editandoId;
            
            if (editingId) {
                actualizarServicio(editingId);
            } else {
                agregarServicio();
            }
        });
    }
    
    const btnLimpiarFormServicio = document.getElementById('btnLimpiarFormServicio');
    if (btnLimpiarFormServicio) {
        btnLimpiarFormServicio.addEventListener('click', limpiarFormServicio);
    }
    
    // Botones de exportar/importar servicios
    const btnDescargarServiciosJSON = document.getElementById('btnDescargarServiciosJSON');
    if (btnDescargarServiciosJSON) {
        btnDescargarServiciosJSON.addEventListener('click', descargarServiciosJSON);
    }
    
    const btnImportarServiciosJSON = document.getElementById('btnImportarServiciosJSON');
    if (btnImportarServiciosJSON) {
        btnImportarServiciosJSON.addEventListener('click', importarServiciosJSON);
    }
    
    const btnImportarServiciosArchivo = document.getElementById('btnImportarServiciosArchivo');
    if (btnImportarServiciosArchivo) {
        btnImportarServiciosArchivo.addEventListener('click', importarServiciosDesdeArchivo);
    }
    
    // Inicializar editor de variantes de servicios si estamos en admin
    if (page === 'admin' && adminLogueado) {
        initVariantesEditorServicioAdmin();
    }
});

