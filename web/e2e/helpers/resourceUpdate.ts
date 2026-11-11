import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';

/** Publish a compatible test release through the real update endpoints. */
export async function publishResourceUpdate(page: Page) {
  const catalog = await page.evaluate(async () => {
    const path = '/src/resources/manager.ts';
    return (await import(/* @vite-ignore */ path)).resources.catalog;
  });
  const next = { ...catalog, releaseId: 'e'.repeat(24), appBuildId: 'refactor-test' };
  const body = JSON.stringify(next),
    manifest = '/assets/garden/manifests/' + next.releaseId + '.json';
  await page.route('**/resource-release.json', (route) =>
    route.fulfill({
      json: {
        schemaVersion: 1,
        releaseId: next.releaseId,
        appBuildId: next.appBuildId,
        url: manifest,
        sha256: createHash('sha256').update(body).digest('hex'),
      },
    }),
  );
  await page.route('**' + manifest, (route) =>
    route.fulfill({ contentType: 'application/json', body }),
  );
}
