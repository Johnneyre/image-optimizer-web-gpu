import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { ImageProcessingService } from '@services/image-processing.service';
import { workspaceImageGuard } from './app.routes';

type GuardServiceStub = Pick<ImageProcessingService, 'hasImage'>;

function configure(hasImage: boolean): void {
  const stub: GuardServiceStub = { hasImage: (() => hasImage) as ImageProcessingService['hasImage'] };
  TestBed.configureTestingModule({
    providers: [{ provide: ImageProcessingService, useValue: stub }, provideRouter([])],
  });
}

function runGuard(): boolean | UrlTree {
  return TestBed.runInInjectionContext(() =>
    workspaceImageGuard({} as never, {} as never),
  ) as boolean | UrlTree;
}

describe('workspaceImageGuard', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('allows activation when an image is present', () => {
    configure(true);
    expect(runGuard()).toBe(true);
  });

  it('redirects to the landing page when no image is present', () => {
    configure(false);
    const result = runGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/');
  });
});
