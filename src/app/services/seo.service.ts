import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import {
  TitleStrategy,
  type RouterStateSnapshot,
  type ActivatedRouteSnapshot,
} from '@angular/router';

/** Origen canónico del sitio. Centralizado para canonical, og:url y sitemap. */
export const SITE_URL = 'https://webgpu-image-optimizer.com';

/** Metadatos SEO asociados a una ruta mediante `data`. */
export interface SeoRouteData {
  /** Meta description específica de la ruta. */
  description?: string;
  /** Ruta canónica relativa (p.ej. "/"); por defecto se usa la URL navegada. */
  canonicalPath?: string;
  /** Marca la ruta como no indexable (robots: noindex). */
  noindex?: boolean;
}

/**
 * Estrategia de título personalizada que, además del `<title>`, mantiene
 * sincronizados la meta description, el canonical y las etiquetas Open Graph /
 * Twitter en cada navegación. Se registra como `TitleStrategy` en `app.config`.
 */
@Injectable({ providedIn: 'root' })
export class SeoTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const title = this.buildTitle(snapshot);
    const data = this.deepestData(snapshot.root);

    if (title) {
      this.title.setTitle(title);
      this.meta.updateTag({ property: 'og:title', content: title });
      this.meta.updateTag({ name: 'twitter:title', content: title });
    }

    const description = data?.description;
    if (description) {
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ property: 'og:description', content: description });
      this.meta.updateTag({ name: 'twitter:description', content: description });
    }

    this.meta.updateTag({
      name: 'robots',
      content: data?.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large',
    });

    const rawPath = snapshot.url.split('?')[0].split('#')[0];
    const path = data?.canonicalPath ?? (rawPath === '' ? '/' : rawPath);
    const url = `${SITE_URL}${path === '/' ? '/' : path}`;
    this.setCanonicalUrl(url);
    this.meta.updateTag({ property: 'og:url', content: url });
  }

  /** Recorre el árbol de rutas y devuelve el `data` SEO más profundo definido. */
  private deepestData(route: ActivatedRouteSnapshot): SeoRouteData | undefined {
    let current: ActivatedRouteSnapshot | null = route;
    let data: SeoRouteData | undefined;
    while (current) {
      if (current.data && Object.keys(current.data).length > 0) {
        data = current.data;
      }
      current = current.firstChild;
    }
    return data;
  }

  /** Crea o actualiza el `<link rel="canonical">` del documento. */
  private setCanonicalUrl(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
