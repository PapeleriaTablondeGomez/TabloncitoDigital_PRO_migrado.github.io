# 🗄️ Base de Datos SQLite Local (Portable)

Tu aplicación ahora usa **SQLite** como base de datos local completamente portable. No requiere instalación ni conexión a internet.

## ✅ Ventajas

- ✅ **100% Local** - Todos los datos están en tu navegador
- ✅ **Portable** - Puedes exportar la base de datos como archivo .db y llevarla contigo
- ✅ **Sin instalación** - Funciona directamente en el navegador
- ✅ **Rápido** - SQLite es muy eficiente
- ✅ **Confiable** - Base de datos probada y usada mundialmente

## 📦 Cómo Funciona

1. **Almacenamiento Automático**: Todos tus datos (productos, ventas, créditos, tareas, servicios) se guardan automáticamente en SQLite
2. **Respaldo en localStorage**: La base de datos también se guarda en localStorage como respaldo
3. **Exportar/Importar**: Puedes exportar tu base de datos como archivo .db y usarla en cualquier navegador

## 🚀 Uso Básico

### Exportar Base de Datos

1. Ve a la página de **Admin**
2. Busca la sección **"Base de Datos SQLite Local (Portable)"**
3. Haz clic en **"💾 Exportar Base de Datos (.db)"**
4. Se descargará un archivo `.db` con todos tus datos

### Importar Base de Datos

1. Ve a la página de **Admin**
2. Busca la sección **"Base de Datos SQLite Local (Portable)"**
3. Haz clic en **"📥 Importar Base de Datos (.db)"**
4. Selecciona el archivo `.db` que quieres importar
5. La página se recargará automáticamente con los datos importados

## 💡 Consejos

- **Exporta regularmente**: Haz respaldos de tu base de datos periódicamente
- **Lleva tu base de datos**: Puedes copiar el archivo .db a una USB y usarlo en otra computadora
- **Múltiples copias**: Mantén varias copias de respaldo en diferentes lugares
- **Nombre descriptivo**: Al exportar, el archivo se nombra automáticamente con la fecha

## 🔧 Estructura de la Base de Datos

La base de datos contiene las siguientes tablas:

- **productos** - Todos tus productos
- **ventas** - Historial de ventas
- **creditos** - Créditos pendientes
- **tareas** - Tareas y recordatorios
- **servicios** - Servicios ofrecidos
- **clientes** - Base de datos de clientes
- **presupuesto** - Información financiera
- **carrito** - Carrito de compras (temporal)

## 📱 Portabilidad

### Usar en otra computadora:

1. Exporta tu base de datos desde la computadora actual
2. Copia el archivo .db a una USB o servicio en la nube
3. En la nueva computadora, abre tu página web
4. Importa el archivo .db
5. ¡Listo! Todos tus datos estarán disponibles

### Usar en otro navegador:

1. Exporta tu base de datos desde el navegador actual
2. Abre tu página web en el nuevo navegador
3. Importa el archivo .db
4. Todos tus datos estarán disponibles

## ⚠️ Notas Importantes

- **No elimines el archivo .db**: Es tu única copia de los datos
- **Haz respaldos frecuentes**: Especialmente antes de hacer cambios importantes
- **El archivo .db contiene todo**: Productos, ventas, créditos, tareas, servicios, etc.
- **Tamaño del archivo**: Depende de cuántos datos tengas, pero generalmente es pequeño (< 10MB)

## 🆘 Solución de Problemas

### La base de datos no se exporta
- Verifica que tengas datos guardados
- Revisa la consola del navegador (F12) para ver errores
- Asegúrate de que sqlite-db.js esté cargado

### No puedo importar la base de datos
- Verifica que el archivo sea un .db válido
- Asegúrate de que el archivo no esté corrupto
- Revisa la consola del navegador (F12) para ver errores

### Los datos no se guardan
- Verifica que SQL.js esté cargado correctamente
- Revisa la consola del navegador (F12)
- Asegúrate de tener espacio en localStorage

## 🔄 Migración desde IndexedDB

Si tenías datos en IndexedDB, se migrarán automáticamente a SQLite la primera vez que uses la aplicación. Los datos antiguos se mantendrán como respaldo.

## 📊 Estadísticas

Puedes ver el tamaño de tu base de datos en la consola del navegador (F12). La base de datos se guarda automáticamente cada vez que haces cambios.

