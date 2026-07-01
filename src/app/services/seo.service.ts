import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import {
  TitleStrategy,
  type RouterStateSnapshot,
  type ActivatedRouteSnapshot,
} from '@angular/router';

/** Canonical origin of the site. Centralized for canonical, og:url and sitemap. */
export const SITE_URL = 'https://webgpu-image-optimizer.com';

/** SEO metadata attached to a route via `data`. */
export interface SeoRouteData {
  /** Route-specific meta description. */
  description?: string;
  /** Relative canonical path (e.g. "/"); defaults to the navigated URL. */
  canonicalPath?: string;
  /** Marks the route as non-indexable (robots: noindex). */
  noindex?: boolean;
}

/**
 * Custom title strategy that, besides the `<title>`, keeps the meta
 * description, the canonical and the Open Graph / Twitter tags in sync on
 * every navigation. Registered as `TitleStrategy` in `app.config`.
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

  /** Walks the route tree and returns the deepest defined SEO `data`. */
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

  /** Creates or updates the document's `<link rel="canonical">`. */
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
