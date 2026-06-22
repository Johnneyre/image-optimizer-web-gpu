<div align="center">

<img src="public/logo.svg" alt="WebGPU Image Optimizer" width="96" height="96" />

# WebGPU Image Optimizer

Comprime y optimiza imágenes **directamente en tu navegador** con WebGPU. Procesamiento acelerado por GPU, 100% privado y sin subir un solo archivo a la nube.

![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![WebGPU](https://img.shields.io/badge/WebGPU-WGSL-005A9C?logo=webgpu&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![Vitest](https://img.shields.io/badge/tested_with-Vitest-6E9F18?logo=vitest&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

</div>

---

## Qué es

**WebGPU Image Optimizer** es una aplicación web que reduce el peso de tus imágenes sin sacrificar calidad perceptible. A diferencia de los compresores online tradicionales, el procesamiento ocurre por completo en tu dispositivo: la GPU aplica los ajustes mediante un _compute shader_ en WGSL y el resultado se codifica a WebP o JPEG dentro de un Web Worker.

Como ningún archivo abandona el navegador, obtienes tres ventajas frente a una solución en servidor:

- **Privacidad total.** Tus imágenes nunca se suben a ningún servidor.
- **Velocidad.** El cómputo en GPU procesa los píxeles en paralelo.

## Cómo funciona

La optimización reparte el trabajo entre tres unidades de cómputo —el **hilo principal**, un **Web Worker** y la **GPU**— sin que tus datos salgan del navegador. Subes la imagen, el worker extrae sus píxeles, la GPU les aplica los ajustes en paralelo con un shader WGSL, el worker los codifica a WebP o JPEG y el hilo principal renderiza el comparador:

![Infografía del flujo de optimización por WebGPU: subes una imagen en el hilo principal, el Web Worker extrae los píxeles, la GPU los procesa en paralelo con un shader WGSL, el worker los codifica a WebP o JPEG y el hilo principal renderiza el comparador antes/después.](public/how-it-works.png)

El núcleo de la aplicación es `ImageProcessingService`, que orquesta un Web Worker dedicado (`image-processor.worker.ts`). El servicio expone el estado mediante _signals_ de Angular y aplica varias optimizaciones para mantener la interfaz fluida:

- **Debounce de 300 ms** al mover los deslizadores, de modo que arrastrar un control no dispara un cómputo por cada píxel de movimiento.
- **Cancelación de peticiones obsoletas** con `switchMap`, para que solo cuente el último ajuste.
- **Caché de píxeles RGBA en el worker.** Si solo cambias la calidad o el formato de salida, el worker reutiliza los datos y vuelve a codificar sin re-ejecutar la GPU.
- **Atajo para calidad máxima.** Cuando eliges calidad 100% sin ajustes de brillo o contraste, la aplicación usa el archivo original directamente.
- **Gestión cuidadosa de las _blob URL_** para evitar fugas de memoria durante las transiciones.

## Características

- **Compresión acelerada por GPU** con un _compute shader_ WGSL.
- **Ajustes en tiempo real** de calidad, brillo y contraste mediante deslizadores.
- **Exportación a WebP y JPEG** con control de calidad por formato.
- **Comparador antes/después** y estadísticas de tamaño, ratio de reducción y tiempo de procesamiento.
- **Carga por arrastrar y soltar** o selector de archivos.
- **Tema claro y oscuro** con detección de la preferencia del sistema.
- **Detección de soporte** de WebGPU con mensaje claro cuando el navegador no es compatible.

La optimización reparte el trabajo entre tres unidades de cómputo —el **hilo principal**, un **Web Worker** y la **GPU**— sin que tus datos salgan del navegador. Subes la imagen, el worker extrae sus píxeles, la GPU les aplica los ajustes en paralelo con un shader WGSL, el worker los codifica a WebP o JPEG y el hilo principal renderiza el comparador:

![Infografía del flujo de optimización por WebGPU: subes una imagen en el hilo principal, el Web Worker extrae los píxeles, la GPU los procesa en paralelo con un shader WGSL, el worker los codifica a WebP o JPEG y el hilo principal renderiza el comparador antes/después.](public/how-it-works.png)

El núcleo de la aplicación es `ImageProcessingService`, que orquesta un Web Worker dedicado (`image-processor.worker.ts`). El servicio expone el estado mediante _signals_ de Angular y aplica varias optimizaciones para mantener la interfaz fluida:

- **Debounce de 300 ms** al mover los deslizadores, de modo que arrastrar un control no dispara un cómputo por cada píxel de movimiento.
- **Cancelación de peticiones obsoletas** con `switchMap`, para que solo cuente el último ajuste.
- **Caché de píxeles RGBA en el worker.** Si solo cambias la calidad o el formato de salida, el worker reutiliza los datos y vuelve a codificar sin re-ejecutar la GPU.
- **Atajo para calidad máxima.** Cuando eliges calidad 100% sin ajustes de brillo o contraste, la aplicación usa el archivo original directamente.
- **Gestión cuidadosa de las _blob URL_** para evitar fugas de memoria durante las transiciones.

## Requisitos previos

- **Node.js** `^20.19.0`, `^22.12.0` o `^24.0.0` (lo exige Angular 21).
- **pnpm** 10 o superior. Si usas [Corepack](https://nodejs.org/api/corepack.html), ejecuta `corepack enable` y la versión correcta se activará sola.
- Un **navegador con WebGPU**, como Chrome o Edge 113 y posteriores.

> [!NOTE]
> Si tu navegador no soporta WebGPU, la aplicación lo detecta y te lo indica en lugar de fallar en silencio.

## Puesta en marcha

Instala las dependencias y arranca el servidor de desarrollo:

```bash
pnpm install
pnpm dev
```

Abre `http://localhost:4200/` o visita la [**demo en vivo**](https://webgpu-image-optimizer.com/).

## Scripts disponibles

| Script       | Descripción                                                      |
| ------------ | ---------------------------------------------------------------- |
| `pnpm dev`   | Inicia el servidor de desarrollo (`ng serve`).                   |
| `pnpm build` | Compila la aplicación para producción en `dist/`.                |
| `pnpm watch` | Recompila en modo desarrollo cada vez que cambias el código.     |
| `pnpm test`  | Ejecuta las pruebas unitarias con [Vitest](https://vitest.dev/). |

## Estructura del proyecto

```text
src/
├── app/
│   ├── components/header/      # Cabecera global: logo, navegación y cambio de tema
│   ├── pages/
│   │   ├── landing/            # Página de inicio
│   │   │   └── components/     # Hero, demo, "cómo funciona", stats, zona de carga, footer y modal de términos
│   │   └── workspace/          # Editor de optimización
│   │       └── components/     # Controles laterales, comparador de imágenes y overlay de descarga
│   ├── services/              # image-processing, theme y seo
│   ├── workers/               # image-processor.worker.ts (WebGPU + shader WGSL)
│   ├── types/                 # Tipos compartidos
│   ├── app.routes.ts          # Rutas y guard de acceso al workspace
│   └── app.config.ts          # Configuración de la aplicación
├── assets/
├── index.html
├── main.ts
└── styles.css
```

La aplicación tiene dos rutas. La ruta raíz (`/`) muestra la landing y la zona de carga. La ruta `/workspace` abre el editor y está protegida por `workspaceImageGuard`, que redirige a la página de inicio si todavía no has cargado ninguna imagen.

## Stack tecnológico

- **[Angular 21](https://angular.dev/)** con componentes _standalone_, _signals_ y carga diferida de rutas.
- **[WebGPU](https://www.w3.org/TR/webgpu/)** y **WGSL** para el procesamiento de imagen en la GPU.
- **[RxJS](https://rxjs.dev/)** para el _pipeline_ reactivo de procesamiento.
- **[Tailwind CSS 4](https://tailwindcss.com/)** para los estilos.
- **[Vitest](https://vitest.dev/)** para las pruebas unitarias.
