/* ============================================================
   BASE DE DATOS SQLITE LOCAL (PORTABLE)
   ============================================================
   
   Usa SQL.js (SQLite compilado a WebAssembly) para crear una
   base de datos SQLite completamente local y portable.
   
   La base de datos se guarda como un archivo .db que puedes
   llevar contigo y usar en cualquier navegador.
*/

let sqliteDB = null; // Instancia de la base de datos SQLite
let SQL = null; // Objeto SQL.js
let guardarBaseDatosTimeout = null; // Timeout para debounce de guardado
let usarIndexedDBParaDB = false; // Flag para usar IndexedDB cuando localStorage está lleno

// Inicializar SQL.js y crear la base de datos
async function inicializarSQLite() {
    if (sqliteDB !== null) {
        return sqliteDB;
    }
    
    try {
        // Cargar SQL.js si no está cargado
        if (typeof SQL === 'undefined' || SQL === null || !SQL.Database) {
            // Esperar a que initSqlJs esté disponible
            let intentos = 0;
            while (typeof initSqlJs === 'undefined' && intentos < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                intentos++;
            }
            
            if (typeof initSqlJs !== 'undefined') {
                // Inicializar SQL.js
                SQL = await initSqlJs({
                    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
                });
            } else if (typeof window.SQL !== 'undefined' && window.SQL.Database) {
                SQL = window.SQL;
            } else {
                console.error('❌ SQL.js no está cargado. Asegúrate de incluir el script sql-wasm.js');
                return null;
            }
        }
        
        // Verificar que SQL esté correctamente inicializado
        if (!SQL || !SQL.Database) {
            console.error('❌ SQL.js no está correctamente inicializado');
            return null;
        }
        
        // Verificar si debemos usar IndexedDB
        const usarIDB = localStorage.getItem('TD_SQLITE_USE_IDB') === 'true';
        
        // Intentar cargar desde localStorage primero
        let dbData = localStorage.getItem('TD_SQLITE_DB');
        let uint8Array = null;
        
        if (dbData && !usarIDB) {
            try {
                uint8Array = Uint8Array.from(atob(dbData), c => c.charCodeAt(0));
                usarIndexedDBParaDB = false;
            } catch (e) {
                console.warn('⚠️ Error al decodificar base de datos de localStorage:', e);
                dbData = null;
            }
        }
        
        // Si no hay datos en localStorage o debemos usar IndexedDB, intentar IndexedDB
        if (!uint8Array && (usarIDB || !dbData)) {
            try {
                const idbData = await cargarBaseDatosDesdeIndexedDB();
                if (idbData) {
                    uint8Array = idbData;
                    usarIndexedDBParaDB = true;
                    console.log('✅ Base de datos SQLite cargada desde IndexedDB');
                }
            } catch (e) {
                console.warn('⚠️ Error al cargar desde IndexedDB:', e);
            }
        }
        
        if (uint8Array) {
            // Cargar base de datos existente
            try {
                sqliteDB = new SQL.Database(uint8Array);
                console.log(`✅ Base de datos SQLite cargada desde ${usarIndexedDBParaDB ? 'IndexedDB' : 'localStorage'}`);
            } catch (e) {
                console.warn('⚠️ Error al cargar base de datos existente, creando nueva:', e);
                sqliteDB = new SQL.Database();
                crearTablas();
                guardarBaseDatos();
            }
        } else {
            // Crear nueva base de datos
            sqliteDB = new SQL.Database();
            crearTablas();
            guardarBaseDatos();
            console.log('✅ Nueva base de datos SQLite creada');
        }
        
        return sqliteDB;
    } catch (error) {
        console.error('❌ Error al inicializar SQLite:', error);
        return null;
    }
}

// Crear todas las tablas necesarias
function crearTablas() {
    if (!sqliteDB) return;
    
    // Tabla de productos
    sqliteDB.run(`
        CREATE TABLE IF NOT EXISTS productos (
            id TEXT PRIMARY KEY,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            precio REAL,
            precioAnterior REAL,
            precioPromo REAL,
            promoActiva INTEGER DEFAULT 0,
            categoria TEXT,
            imagen TEXT,
            stock INTEGER DEFAULT 0,
            sku TEXT,
            packPrecio REAL,
            packCantidad INTEGER,
            variantes TEXT,
            datos TEXT,
            createdAt TEXT,
            updatedAt TEXT
        )
    `);
    
    // Tabla de ventas
    sqliteDB.run(`
        CREATE TABLE IF NOT EXISTS ventas (
            id TEXT PRIMARY KEY,
            productos TEXT NOT NULL,
            total REAL NOT NULL,
            fecha TEXT NOT NULL,
            tipo TEXT,
            cliente TEXT,
            telefono TEXT,
            notas TEXT,
            datos TEXT,
            createdAt TEXT
        )
    `);
    
    // Tabla de créditos
    sqliteDB.run(`
        CREATE TABLE IF NOT EXISTS creditos (
            id TEXT PRIMARY KEY,
            cliente TEXT NOT NULL,
            telefono TEXT,
            producto TEXT,
            monto REAL NOT NULL,
            fecha TEXT NOT NULL,
            descripcion TEXT,
            notas TEXT,
            pagado INTEGER DEFAULT 0,
            fechaPago TEXT,
            items TEXT,
            datos TEXT,
            createdAt TEXT
        )
    `);
    
    // Tabla de tareas
    sqliteDB.run(`
        CREATE TABLE IF NOT EXISTS tareas (
            id TEXT PRIMARY KEY,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            fechaEntrega TEXT NOT NULL,
            pagada INTEGER DEFAULT 0,
            completada INTEGER DEFAULT 0,
            fechaCreacion TEXT,
            datos TEXT
        )
    `);
    
    // Tabla de servicios
    sqliteDB.run(`
        CREATE TABLE IF NOT EXISTS servicios (
            id TEXT PRIMARY KEY,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            precio REAL NOT NULL,
            imagen TEXT,
            variantes TEXT,
            datos TEXT,
            createdAt TEXT,
            updatedAt TEXT
        )
    `);
    
    // Tabla de clientes
    sqliteDB.run(`
        CREATE TABLE IF NOT EXISTS clientes (
            id TEXT PRIMARY KEY,
            nombre TEXT NOT NULL,
            telefono TEXT,
            ultimaVenta TEXT,
            datos TEXT
        )
    `);
    
    // Tabla de presupuesto
    sqliteDB.run(`
        CREATE TABLE IF NOT EXISTS presupuesto (
            id TEXT PRIMARY KEY DEFAULT 'main',
            dineroNequi REAL DEFAULT 0,
            dineroFisico REAL DEFAULT 0,
            dineroPropio TEXT,
            prestamosPropios TEXT,
            datos TEXT
        )
    `);
    
    // Tabla de carrito (temporal)
    sqliteDB.run(`
        CREATE TABLE IF NOT EXISTS carrito (
            id TEXT PRIMARY KEY,
            productoId TEXT,
            cantidad INTEGER,
            tipoVenta TEXT,
            datos TEXT
        )
    `);
    
    // Agregar columnas faltantes a tablas existentes (migración)
    try {
        // Verificar y agregar columnas faltantes en creditos
        const creditosInfo = sqliteDB.exec("PRAGMA table_info(creditos)");
        if (creditosInfo.length > 0) {
            const columnas = creditosInfo[0].values.map(row => row[1]);
            if (!columnas.includes('producto')) {
                sqliteDB.run("ALTER TABLE creditos ADD COLUMN producto TEXT");
            }
            if (!columnas.includes('notas')) {
                sqliteDB.run("ALTER TABLE creditos ADD COLUMN notas TEXT");
            }
            if (!columnas.includes('items')) {
                sqliteDB.run("ALTER TABLE creditos ADD COLUMN items TEXT");
            }
        }
        
        // Verificar y agregar columnas faltantes en servicios
        const serviciosInfo = sqliteDB.exec("PRAGMA table_info(servicios)");
        if (serviciosInfo.length > 0) {
            const columnas = serviciosInfo[0].values.map(row => row[1]);
            if (!columnas.includes('variantes')) {
                sqliteDB.run("ALTER TABLE servicios ADD COLUMN variantes TEXT");
            }
        }
    } catch (e) {
        console.warn('Error al verificar/agregar columnas faltantes:', e);
    }
    
    console.log('✅ Tablas creadas en SQLite');
}

// Guardar la base de datos en localStorage (con debounce para evitar stack overflow)
function guardarBaseDatos() {
    if (!sqliteDB) return;
    
    // Limpiar timeout anterior si existe
    if (guardarBaseDatosTimeout) {
        clearTimeout(guardarBaseDatosTimeout);
    }
    
    // Usar debounce para evitar guardar demasiadas veces seguidas
    guardarBaseDatosTimeout = setTimeout(async () => {
        try {
            const data = sqliteDB.export();
            
            // Intentar guardar en localStorage primero
            try {
                // Método más eficiente para convertir Uint8Array a base64
                // Evita stack overflow con arrays grandes
                let binaryString = '';
                const chunkSize = 8192; // Procesar en chunks de 8KB
                for (let i = 0; i < data.length; i += chunkSize) {
                    const chunk = data.slice(i, i + chunkSize);
                    binaryString += String.fromCharCode.apply(null, chunk);
                }
                
                const base64 = btoa(binaryString);
                localStorage.setItem('TD_SQLITE_DB', base64);
                localStorage.removeItem('TD_SQLITE_USE_IDB'); // Ya no usamos IndexedDB
                usarIndexedDBParaDB = false;
                console.log('💾 Base de datos SQLite guardada en localStorage');
            } catch (error) {
                // Si localStorage está lleno, usar IndexedDB
                if (error.name === 'QuotaExceededError' || error.code === 22) {
                    console.warn('⚠️ localStorage lleno, guardando en IndexedDB...');
                    const guardado = await guardarBaseDatosEnIndexedDB();
                    if (guardado) {
                        usarIndexedDBParaDB = true;
                        console.log('💾 Base de datos SQLite guardada en IndexedDB');
                    } else {
                        console.error('❌ No se pudo guardar la base de datos');
                    }
                } else {
                    throw error;
                }
            }
        } catch (error) {
            console.error('❌ Error al guardar base de datos:', error);
        }
        
        guardarBaseDatosTimeout = null;
    }, 100); // Debounce de 100ms
}

// Guardar base de datos SQLite en IndexedDB
async function guardarBaseDatosEnIndexedDB() {
    if (!sqliteDB) return false;
    
    try {
        // Inicializar IndexedDB si no está inicializado
        let idb = null;
        if (typeof initIndexedDB === 'function') {
            idb = await initIndexedDB();
        } else if (typeof window.initIndexedDB === 'function') {
            idb = await window.initIndexedDB();
        } else {
            console.warn('⚠️ IndexedDB no está disponible');
            return false;
        }
        
        const data = sqliteDB.export();
        
        // Obtener referencia a IndexedDB
        const db = window.db || idb || null;
        if (!db) {
            console.warn('⚠️ IndexedDB no está inicializado');
            return false;
        }
        
        const transaction = db.transaction(['config'], 'readwrite');
        const store = transaction.objectStore('config');
        
        // Verificar el keyPath del store
        // El store 'config' puede tener 'key' o 'id' como keyPath
        // Intentamos detectar cuál usar basándonos en el error o usando ambos campos
        
        return new Promise((resolve, reject) => {
            // Intentar primero con 'key' (formato más común en el código existente)
            const objeto = {
                key: 'sqlite_db',
                id: 'sqlite_db', // También incluir id por si acaso
                data: data,
                timestamp: new Date().toISOString()
            };
            
            const request = store.put(objeto);
            
            request.onsuccess = () => {
                console.log('💾 Base de datos SQLite guardada en IndexedDB');
                localStorage.setItem('TD_SQLITE_USE_IDB', 'true'); // Marcar que usamos IndexedDB
                usarIndexedDBParaDB = true;
                resolve(true);
            };
            
            request.onerror = () => {
                console.error('❌ Error al guardar en IndexedDB:', request.error);
                // Si el error es por keyPath, intentar solo con 'key'
                if (request.error && request.error.name === 'DataError') {
                    console.warn('⚠️ Error de keyPath, intentando solo con key...');
                    const objeto2 = {
                        key: 'sqlite_db',
                        data: data,
                        timestamp: new Date().toISOString()
                    };
                    const request2 = store.put(objeto2);
                    
                    request2.onsuccess = () => {
                        console.log('💾 Base de datos SQLite guardada en IndexedDB (solo key)');
                        localStorage.setItem('TD_SQLITE_USE_IDB', 'true');
                        usarIndexedDBParaDB = true;
                        resolve(true);
                    };
                    
                    request2.onerror = () => {
                        console.error('❌ Error al guardar en IndexedDB (segundo intento):', request2.error);
                        reject(request2.error);
                    };
                } else {
                    reject(request.error);
                }
            };
        });
    } catch (error) {
        console.error('❌ Error al guardar base de datos en IndexedDB:', error);
        return false;
    }
}

// Cargar base de datos SQLite desde IndexedDB
async function cargarBaseDatosDesdeIndexedDB() {
    try {
        // Inicializar IndexedDB si no está inicializado
        let idb = null;
        if (typeof initIndexedDB === 'function') {
            idb = await initIndexedDB();
        } else if (typeof window.initIndexedDB === 'function') {
            idb = await window.initIndexedDB();
        } else {
            return null;
        }
        
        // Obtener referencia a IndexedDB
        const db = window.db || idb || null;
        if (!db) {
            return null;
        }
        
        const transaction = db.transaction(['config'], 'readonly');
        const store = transaction.objectStore('config');
        
        return new Promise((resolve, reject) => {
            // Intentar cargar con 'key' primero (formato más común)
            let request = store.get('sqlite_db');
            
            request.onsuccess = () => {
                let result = request.result;
                
                // Si no se encontró, puede que el store use 'id' como keyPath
                // En ese caso, necesitamos buscar de otra manera
                if (!result) {
                    // Intentar buscar usando un índice o recorriendo todos los registros
                    const getAllRequest = store.getAll();
                    getAllRequest.onsuccess = () => {
                        const allResults = getAllRequest.result || [];
                        // Buscar el registro que tenga key o id igual a 'sqlite_db'
                        result = allResults.find(r => 
                            (r.key === 'sqlite_db' || r.id === 'sqlite_db')
                        );
                        
                        if (result && result.data) {
                            console.log('✅ Base de datos SQLite cargada desde IndexedDB (búsqueda alternativa)');
                            usarIndexedDBParaDB = true;
                            resolve(result.data);
                        } else {
                            console.warn('⚠️ No se encontró base de datos en IndexedDB');
                            resolve(null);
                        }
                    };
                    getAllRequest.onerror = () => {
                        console.warn('⚠️ No se encontró base de datos en IndexedDB');
                        resolve(null);
                    };
                    return;
                }
                
                if (result && result.data) {
                    console.log('✅ Base de datos SQLite cargada desde IndexedDB');
                    usarIndexedDBParaDB = true;
                    resolve(result.data);
                } else {
                    resolve(null);
                }
            };
            
            request.onerror = () => {
                console.error('❌ Error al cargar desde IndexedDB:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('❌ Error al cargar base de datos desde IndexedDB:', error);
        return null;
    }
}

// Guardar la base de datos inmediatamente (sin debounce) - para importación
async function guardarBaseDatosSync() {
    if (!sqliteDB) return;
    
    try {
        // Cancelar cualquier guardado pendiente
        if (guardarBaseDatosTimeout) {
            clearTimeout(guardarBaseDatosTimeout);
            guardarBaseDatosTimeout = null;
        }
        
        const data = sqliteDB.export();
        
        // Intentar guardar en localStorage primero
        try {
            // Método más eficiente para convertir Uint8Array a base64
            // Evita stack overflow con arrays grandes
            let binaryString = '';
            const chunkSize = 8192; // Procesar en chunks de 8KB
            for (let i = 0; i < data.length; i += chunkSize) {
                const chunk = data.slice(i, i + chunkSize);
                binaryString += String.fromCharCode.apply(null, chunk);
            }
            
            const base64 = btoa(binaryString);
            localStorage.setItem('TD_SQLITE_DB', base64);
            localStorage.removeItem('TD_SQLITE_USE_IDB'); // Ya no usamos IndexedDB
            usarIndexedDBParaDB = false;
            console.log('💾 Base de datos SQLite guardada en localStorage (síncrono)');
        } catch (error) {
            // Si localStorage está lleno, usar IndexedDB
            if (error.name === 'QuotaExceededError' || error.code === 22) {
                console.warn('⚠️ localStorage lleno, guardando en IndexedDB...');
                const guardado = await guardarBaseDatosEnIndexedDB();
                if (guardado) {
                    usarIndexedDBParaDB = true;
                    console.log('✅ Base de datos guardada en IndexedDB (localStorage lleno)');
                } else {
                    throw new Error('No se pudo guardar la base de datos ni en localStorage ni en IndexedDB');
                }
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('❌ Error al guardar base de datos:', error);
        throw error;
    }
}

// Exportar base de datos como archivo .db
function exportarBaseDatos() {
    if (!sqliteDB) {
        alert('❌ No hay base de datos para exportar');
        return;
    }
    
    try {
        const data = sqliteDB.export();
        const blob = new Blob([data], { type: 'application/x-sqlite3' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tabloncito-digital-${new Date().toISOString().split('T')[0]}.db`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('✅ Base de datos exportada');
        alert('✅ Base de datos exportada correctamente.\n\nPuedes llevar este archivo .db contigo y usarlo en cualquier navegador.');
    } catch (error) {
        console.error('❌ Error al exportar base de datos:', error);
        alert('❌ Error al exportar: ' + error.message);
    }
}

// Importar base de datos desde archivo .db
async function importarBaseDatos(archivo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            try {
                // Verificar que SQL.js esté disponible
                if (!SQL || !SQL.Database) {
                    // Intentar inicializar SQL.js si no está disponible
                    await inicializarSQLite();
                    if (!SQL || !SQL.Database) {
                        throw new Error('SQL.js no está disponible. Por favor recarga la página.');
                    }
                }
                
                const uint8Array = new Uint8Array(e.target.result);
                const nuevaDB = new SQL.Database(uint8Array);
                
                // Verificar que la base de datos tenga las tablas necesarias
                try {
                    const tables = nuevaDB.exec("SELECT name FROM sqlite_master WHERE type='table'");
                    console.log('📋 Tablas encontradas en la base de datos importada:', tables[0]?.values || []);
                } catch (e) {
                    console.warn('⚠️ No se pudieron verificar las tablas:', e);
                }
                
                // Cerrar base de datos anterior si existe
                if (sqliteDB) {
                    try {
                        sqliteDB.close();
                    } catch (e) {
                        console.warn('⚠️ Error al cerrar base de datos anterior:', e);
                    }
                }
                
                sqliteDB = nuevaDB;
                
                // Guardar inmediatamente (sin debounce) para asegurar que se guarde antes de continuar
                try {
                    await guardarBaseDatosSync();
                    console.log('✅ Base de datos guardada correctamente');
                } catch (error) {
                    // Si falla el guardado, mostrar mensaje pero continuar
                    console.error('⚠️ Error al guardar base de datos después de importar:', error);
                    if (error.name === 'QuotaExceededError' || error.code === 22) {
                        alert('⚠️ La base de datos es muy grande para localStorage.\n\nSe guardará en IndexedDB automáticamente.\n\nLa base de datos se cargará correctamente, pero necesitarás usar IndexedDB para almacenarla.');
                    }
                }
                
                // Esperar un momento para asegurar que se haya guardado
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Recargar todos los datos desde la nueva base de datos
                try {
                    await cargarDatos();
                    console.log('✅ Base de datos importada y datos cargados');
                    
                    // Verificar que los datos se cargaron correctamente
                    const productosCargados = typeof productos !== 'undefined' ? productos.length : 0;
                    const ventasCargadas = typeof ventas !== 'undefined' ? ventas.length : 0;
                    const creditosCargados = typeof creditos !== 'undefined' ? creditos.length : 0;
                    const tareasCargadas = typeof tareas !== 'undefined' ? tareas.length : 0;
                    const serviciosCargados = typeof servicios !== 'undefined' ? servicios.length : 0;
                    
                    console.log(`📊 Datos cargados: ${productosCargados} productos, ${ventasCargadas} ventas, ${creditosCargados} créditos, ${tareasCargadas} tareas, ${serviciosCargados} servicios`);
                    
                    alert(`✅ Base de datos importada correctamente.\n\nDatos cargados:\n• ${productosCargados} productos\n• ${ventasCargadas} ventas\n• ${creditosCargados} créditos\n• ${tareasCargadas} tareas\n• ${serviciosCargados} servicios\n\nLa página se recargará para mostrar los datos.`);
                    
                    resolve(true);
                } catch (error) {
                    console.error('❌ Error al cargar datos después de importar:', error);
                    alert('⚠️ Base de datos importada pero hubo un error al cargar los datos. La página se recargará.\n\nError: ' + error.message);
                    resolve(true); // Resolver igual para que recargue la página
                }
            } catch (error) {
                console.error('❌ Error al importar base de datos:', error);
                alert('❌ Error al importar: ' + error.message);
                reject(error);
            }
        };
        
        reader.onerror = function(error) {
            console.error('❌ Error al leer el archivo:', error);
            reject(new Error('Error al leer el archivo. Asegúrate de que es un archivo .db válido.'));
        };
        
        reader.readAsArrayBuffer(archivo);
    });
}

// Guardar productos en SQLite
async function guardarProductosSQLite(productosArray) {
    if (!sqliteDB) {
        await inicializarSQLite();
    }
    
    if (!sqliteDB) return false;
    
    try {
        // Limpiar tabla
        sqliteDB.run('DELETE FROM productos');
        
        // Insertar productos
        const stmt = sqliteDB.prepare(`
            INSERT INTO productos (
                id, nombre, descripcion, precio, precioAnterior, precioPromo,
                promoActiva, categoria, imagen, stock, sku, packPrecio,
                packCantidad, variantes, datos, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        productosArray.forEach(producto => {
            stmt.run([
                String(producto.id || Date.now() + Math.random()),
                String(producto.nombre || ''),
                String(producto.descripcion || ''),
                Number(producto.precio || 0),
                Number(producto.precioAnterior || 0),
                Number(producto.precioPromo || 0),
                producto.promoActiva ? 1 : 0,
                String(producto.categoria || ''),
                String(producto.imagen || ''),
                Number(producto.stock || 0),
                String(producto.sku || ''),
                Number(producto.packPrecio || 0),
                Number(producto.packCantidad || 0),
                JSON.stringify(producto.variantes || []),
                JSON.stringify(producto),
                producto.createdAt || new Date().toISOString(),
                new Date().toISOString()
            ]);
        });
        
        stmt.free();
        guardarBaseDatos();
        console.log(`✅ ${productosArray.length} productos guardados en SQLite`);
        return true;
    } catch (error) {
        console.error('❌ Error al guardar productos en SQLite:', error);
        return false;
    }
}

// Cargar productos desde SQLite
async function cargarProductosSQLite() {
    if (!sqliteDB) {
        await inicializarSQLite();
    }
    
    if (!sqliteDB) return [];
    
    try {
        const result = sqliteDB.exec('SELECT * FROM productos ORDER BY nombre');
        if (result.length === 0) return [];
        
        const productos = [];
        const rows = result[0].values;
        const columns = result[0].columns;
        
        rows.forEach(row => {
            const producto = {};
            columns.forEach((col, index) => {
                producto[col] = row[index];
            });
            
            // Parsear campos JSON
            if (producto.variantes) {
                try {
                    producto.variantes = JSON.parse(producto.variantes);
                } catch (e) {
                    producto.variantes = [];
                }
            }
            
            if (producto.datos) {
                try {
                    const datos = JSON.parse(producto.datos);
                    Object.assign(producto, datos);
                } catch (e) {}
            }
            
            // Convertir booleanos
            producto.promoActiva = producto.promoActiva === 1;
            
            productos.push(producto);
        });
        
        console.log(`✅ ${productos.length} productos cargados desde SQLite`);
        return productos;
    } catch (error) {
        console.error('❌ Error al cargar productos desde SQLite:', error);
        return [];
    }
}

// Guardar ventas en SQLite
async function guardarVentasSQLite(ventasArray) {
    if (!sqliteDB) {
        await inicializarSQLite();
    }
    
    if (!sqliteDB) return false;
    
    try {
        sqliteDB.run('DELETE FROM ventas');
        
        const stmt = sqliteDB.prepare(`
            INSERT INTO ventas (id, productos, total, fecha, tipo, cliente, telefono, notas, datos, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        ventasArray.forEach(venta => {
            stmt.run([
                String(venta.id || Date.now() + Math.random()),
                JSON.stringify(venta.productos || []),
                Number(venta.total || 0),
                String(venta.fecha || new Date().toISOString()),
                String(venta.tipo || ''),
                String(venta.cliente || ''),
                String(venta.telefono || ''),
                String(venta.notas || ''),
                JSON.stringify(venta),
                venta.createdAt || new Date().toISOString()
            ]);
        });
        
        stmt.free();
        guardarBaseDatos();
        console.log(`✅ ${ventasArray.length} ventas guardadas en SQLite`);
        return true;
    } catch (error) {
        console.error('❌ Error al guardar ventas en SQLite:', error);
        return false;
    }
}

// Cargar ventas desde SQLite
async function cargarVentasSQLite() {
    if (!sqliteDB) {
        await inicializarSQLite();
    }
    
    if (!sqliteDB) return [];
    
    try {
        const result = sqliteDB.exec('SELECT * FROM ventas ORDER BY fecha DESC');
        if (result.length === 0) return [];
        
        const ventas = [];
        const rows = result[0].values;
        const columns = result[0].columns;
        
        rows.forEach(row => {
            const venta = {};
            columns.forEach((col, index) => {
                venta[col] = row[index];
            });
            
            // Parsear JSON
            if (venta.productos) {
                try {
                    venta.productos = JSON.parse(venta.productos);
                } catch (e) {
                    venta.productos = [];
                }
            }
            
            if (venta.datos) {
                try {
                    const datos = JSON.parse(venta.datos);
                    Object.assign(venta, datos);
                } catch (e) {}
            }
            
            ventas.push(venta);
        });
        
        console.log(`✅ ${ventas.length} ventas cargadas desde SQLite`);
        return ventas;
    } catch (error) {
        console.error('❌ Error al cargar ventas desde SQLite:', error);
        return [];
    }
}

// Función genérica para guardar cualquier colección
async function guardarEnSQLite(tabla, datos) {
    if (!sqliteDB) {
        await inicializarSQLite();
    }
    
    if (!sqliteDB) return false;
    
    try {
        // Limpiar tabla
        sqliteDB.run(`DELETE FROM ${tabla}`);
        
        if (!Array.isArray(datos) || datos.length === 0) {
            guardarBaseDatos();
            return true;
        }
        
        // Obtener columnas de la tabla desde SQLite
        let columnasTabla = [];
        try {
            const result = sqliteDB.exec(`PRAGMA table_info(${tabla})`);
            if (result.length > 0) {
                columnasTabla = result[0].values.map(row => row[1]); // row[1] es el nombre de la columna
            }
        } catch (e) {
            console.warn(`No se pudieron obtener columnas de ${tabla}, usando todas las del objeto`);
        }
        
        // Obtener estructura de la primera fila
        const primeraFila = datos[0];
        const columnasObjeto = Object.keys(primeraFila);
        
        // Filtrar columnas: solo usar las que existen en la tabla
        let columnas = columnasObjeto;
        if (columnasTabla.length > 0) {
            columnas = columnasObjeto.filter(col => columnasTabla.includes(col));
            // Si hay columnas faltantes, guardarlas en el campo 'datos'
            const columnasFaltantes = columnasObjeto.filter(col => !columnasTabla.includes(col) && col !== 'datos');
            if (columnasFaltantes.length > 0) {
                console.warn(`⚠️ Columnas no encontradas en tabla ${tabla}, guardadas en campo 'datos':`, columnasFaltantes);
            }
        }
        
        if (columnas.length === 0) {
            console.warn(`⚠️ No hay columnas válidas para insertar en ${tabla}`);
            guardarBaseDatos();
            return false;
        }
        
        // Crear query dinámico
        const placeholders = columnas.map(() => '?').join(', ');
        const columnasStr = columnas.join(', ');
        const stmt = sqliteDB.prepare(`INSERT INTO ${tabla} (${columnasStr}) VALUES (${placeholders})`);
        
        datos.forEach(item => {
            const valores = columnas.map(col => {
                const valor = item[col];
                // Convertir objetos/arrays a JSON
                if (typeof valor === 'object' && valor !== null && !Array.isArray(valor)) {
                    return JSON.stringify(valor);
                }
                // Convertir arrays a JSON
                if (Array.isArray(valor)) {
                    return JSON.stringify(valor);
                }
                // Convertir booleanos a enteros
                if (typeof valor === 'boolean') {
                    return valor ? 1 : 0;
                }
                // Manejar null/undefined
                if (valor === null || valor === undefined) {
                    return null;
                }
                return valor;
            });
            
            try {
                stmt.run(valores);
            } catch (e) {
                console.warn(`Error al insertar registro en ${tabla}:`, e, valores);
            }
        });
        
        stmt.free();
        guardarBaseDatos();
        console.log(`✅ ${datos.length} registros guardados en SQLite: ${tabla}`);
        return true;
    } catch (error) {
        console.error(`❌ Error al guardar en SQLite (${tabla}):`, error);
        return false;
    }
}

// Función genérica para cargar cualquier colección
async function cargarDeSQLite(tabla) {
    if (!sqliteDB) {
        await inicializarSQLite();
    }
    
    if (!sqliteDB) return [];
    
    try {
        const result = sqliteDB.exec(`SELECT * FROM ${tabla}`);
        if (result.length === 0) return [];
        
        const datos = [];
        const rows = result[0].values;
        const columns = result[0].columns;
        
        rows.forEach(row => {
            const item = {};
            columns.forEach((col, index) => {
                let valor = row[index];
                
                // Intentar parsear JSON
                if (typeof valor === 'string' && (valor.startsWith('{') || valor.startsWith('['))) {
                    try {
                        valor = JSON.parse(valor);
                    } catch (e) {}
                }
                
                // Convertir enteros a booleanos donde corresponda
                if (typeof valor === 'number' && (col.includes('activa') || col.includes('pagada') || col.includes('completada'))) {
                    valor = valor === 1;
                }
                
                item[col] = valor;
            });
            
            // Si hay campo 'datos', fusionar con el objeto principal
            if (item.datos && typeof item.datos === 'object') {
                Object.assign(item, item.datos);
                delete item.datos;
            }
            
            datos.push(item);
        });
        
        console.log(`✅ ${datos.length} registros cargados desde SQLite: ${tabla}`);
        return datos;
    } catch (error) {
        console.error(`❌ Error al cargar desde SQLite (${tabla}):`, error);
        return [];
    }
}

