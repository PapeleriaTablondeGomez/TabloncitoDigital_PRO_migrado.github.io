# 📋 Plantilla para Importar Productos desde Excel/CSV

## Instrucciones de uso:

1. **Descarga la plantilla**: Abre el archivo `plantilla_productos.csv` con Excel o Google Sheets
2. **Completa los datos**: Llena las columnas con la información de tus productos
3. **Guarda como CSV**: Guarda el archivo como CSV (valores separados por comas)
4. **Importa en el admin**: Ve al panel de administración → Herramientas → Importar productos (CSV Excel)

---

## 📝 Columnas de la Plantilla

### ✅ Columnas OBLIGATORIAS (deben tener datos):

| Columna | Descripción | Ejemplo | Tipo |
|---------|-------------|---------|------|
| **nombre** | Nombre del producto | Bolígrafo Azul | Texto |
| **precioventa** | Precio de venta por unidad | 1200 | Número |
| **stock** | Cantidad disponible en inventario | 50 | Número |

### 📌 Columnas OPCIONALES (pueden estar vacías):

| Columna | Descripción | Ejemplo | Tipo |
|---------|-------------|---------|------|
| **descripcion** | Descripción del producto | Un bolígrafo azul de alta calidad | Texto |
| **costo** | Precio de costo/compra | 500 | Número |
| **categoria** | Categoría del producto | Bolígrafos | Texto |
| **sku** | Código SKU o de barras | 7701234567890 | Texto |
| **imagenprincipal** | URL de la imagen principal | https://ejemplo.com/imagen.jpg | URL |

---

## ⚠️ IMPORTANTE:

1. **Formato de números**: Los precios y stock deben ser números enteros (sin puntos ni comas)
   - ✅ Correcto: `1200`, `50`, `500`
   - ❌ Incorrecto: `1.200`, `1,200`, `50.5`

2. **Formato de texto**: Si el texto contiene comas, debe ir entre comillas dobles
   - ✅ Correcto: `"Bolígrafo, Azul"` o `Bolígrafo Azul`
   - ❌ Incorrecto: `Bolígrafo, Azul` (sin comillas)

3. **Nombres de columnas**: Deben escribirse exactamente como se muestra (en minúsculas, sin espacios)
   - ✅ Correcto: `nombre`, `precioventa`, `stock`
   - ❌ Incorrecto: `Nombre`, `Precio Venta`, `STOCK`

4. **Columnas vacías**: Las columnas opcionales pueden dejarse vacías, pero deben existir en el archivo

---

## 📊 Ejemplo de Datos:

```csv
nombre,descripcion,costo,precioventa,stock,categoria,sku,imagenprincipal
Bolígrafo Azul,Un bolígrafo azul de alta calidad,500,1200,50,Bolígrafos,7701234567890,https://ejemplo.com/imagen1.jpg
Lápiz HB 2,Un lápiz HB número 2,300,800,100,Lápices,7701234567891,https://ejemplo.com/imagen2.jpg
Marcador Rojo,Marcador permanente color rojo,800,2000,30,Marcadores,,https://ejemplo.com/imagen3.jpg
```

---

## 🔍 Notas Adicionales:

- **Variantes**: Las variantes (colores, tamaños, etc.) NO se pueden importar desde CSV. Debes agregarlas manualmente desde el panel de administración después de importar el producto.

- **Packs**: Los packs (venta por paquetes) NO se pueden importar desde CSV. Debes configurarlos manualmente desde el panel de administración.

- **Promociones**: Las promociones NO se pueden importar desde CSV. Debes activarlas manualmente desde el panel de administración.

- **Imágenes**: Puedes usar URLs de imágenes o subirlas manualmente después de importar el producto.

---

## ✅ Checklist antes de importar:

- [ ] Todas las filas tienen al menos: nombre, precioventa y stock
- [ ] Los números están en formato correcto (sin puntos ni comas decimales)
- [ ] Los nombres de las columnas están escritos correctamente
- [ ] El archivo está guardado como CSV (valores separados por comas)
- [ ] No hay filas completamente vacías

---

## 🆘 Solución de Problemas:

**Error: "El CSV debe tener al menos las columnas: nombre, precioVenta, stock"**
- Verifica que los nombres de las columnas estén escritos exactamente como se muestra
- Asegúrate de que la primera fila contenga los nombres de las columnas

**Error: "No se pudieron leer productos del CSV"**
- Verifica que todas las filas tengan al menos nombre y precioventa
- Asegúrate de que los números estén en formato correcto

**Los productos se importan pero sin datos:**
- Verifica que los datos estén en las columnas correctas
- Asegúrate de que no haya espacios extra al inicio o final de los datos





