# Mi Azúcar

Web app (PWA) para registrar la glucosa: rápida, clara y en español.

## Qué hace
- Registro en segundos, con momento del día, etiquetas (comida, ejercicio, medicina, insulina…) y nota.
- Editar y borrar mediciones (con "Deshacer").
- Tarjeta principal con estado, consejo y tendencia frente a la medición anterior.
- Gráfica de 7, 14 o 30 días, tiempo en meta (30 días), racha de días registrando.
- A1c estimada con el promedio de hasta 90 días.
- Historial por día con filtro por momento; promedios por momento (7/30/90 días).
- Reporte para el médico: imprimir / guardar PDF, copiar resumen o descargar CSV.
- Respaldo: descargar y cargar un archivo JSON (para cambiar de teléfono).
- Sección Aprende, Negocios aliados y formulario para anunciantes (WhatsApp/correo).
- Instalable en el teléfono y funciona sin internet. Tema claro/oscuro y letra grande.

Los datos se guardan solo en el navegador del usuario (localStorage); no hay servidor.

## Configuración
En `app.js`, al inicio, pon tu WhatsApp y/o correo en `CONTACT` para que las
solicitudes de negocios te lleguen directo.

## Despliegue
Sitio estático en Render (`render.yaml`). Cada `git push` a `main` vuelve a publicar.
