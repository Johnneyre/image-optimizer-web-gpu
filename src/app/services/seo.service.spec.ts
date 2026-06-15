import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Title, Meta } from '@angular/platform-browser';
import { SeoTitleStrategy, SITE_URL } from './seo.service';

@Component({
  template: '',
})
class DummyComponent {}

describe('SeoTitleStrategy', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: DummyComponent,
            title: 'Home Title',
            data: { description: 'Home desc', canonicalPath: '/' },
          },
          {
            path: 'ws',
            component: DummyComponent,
            title: 'WS Title',
            data: { description: 'WS desc', noindex: true },
          },
        ]),
        { provide: TitleStrategy, useClass: SeoTitleStrategy },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    const canonical = document.head.querySelector('link[rel="canonical"]');
    canonical?.remove();
  });

  it('should set the document title on navigation', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');

    expect(TestBed.inject(Title).getTitle()).toBe('Home Title');
  });

  it('should set the meta description on navigation', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');

    const meta = TestBed.inject(Meta);
    expect(meta.getTag('name="description"')?.content).toBe('Home desc');
  });

  it('should mirror the title into og:title and twitter:title', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');

    const meta = TestBed.inject(Meta);
    expect(meta.getTag('property="og:title"')?.content).toBe('Home Title');
    expect(meta.getTag('name="twitter:title"')?.content).toBe('Home Title');
  });

  it('should mirror the description into og:description and twitter:description', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');

    const meta = TestBed.inject(Meta);
    expect(meta.getTag('property="og:description"')?.content).toBe('Home desc');
    expect(meta.getTag('name="twitter:description"')?.content).toBe('Home desc');
  });

  it('should set the canonical link and og:url for the home route', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');

    const canonical = document.head
      .querySelector('link[rel="canonical"]')
      ?.getAttribute('href');
    expect(canonical).toBe(`${SITE_URL}/`);

    const meta = TestBed.inject(Meta);
    expect(meta.getTag('property="og:url"')?.content).toBe(`${SITE_URL}/`);
  });

  it('should mark the home route as indexable in the robots meta', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');

    const meta = TestBed.inject(Meta);
    const robots = meta.getTag('name="robots"')?.content;
    expect(robots).toContain('index');
    expect(robots).not.toContain('noindex');
  });

  it('should mark a noindex route in the robots meta', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/ws');

    const meta = TestBed.inject(Meta);
    expect(meta.getTag('name="robots"')?.content).toContain('noindex');
  });

  it('should derive the canonical and og:url from the navigated path when no canonicalPath is set', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/ws');

    const canonical = document.head
      .querySelector('link[rel="canonical"]')
      ?.getAttribute('href');
    expect(canonical).toBe(`${SITE_URL}/ws`);

    const meta = TestBed.inject(Meta);
    expect(meta.getTag('property="og:url"')?.content).toBe(`${SITE_URL}/ws`);
  });

  it('should update SEO tags when navigating between routes', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    await harness.navigateByUrl('/ws');

    const meta = TestBed.inject(Meta);
    expect(TestBed.inject(Title).getTitle()).toBe('WS Title');
    expect(meta.getTag('name="description"')?.content).toBe('WS desc');
    expect(meta.getTag('property="og:title"')?.content).toBe('WS Title');
  });
});
