import { publishResourceUpdate } from './helpers/resourceUpdate';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';

const root = '/experiments/pinyin-garden/';
const sharedUrl = `/@fs/${fileURLToPath(new URL('../../shared/src/index.ts', import.meta.url))}`;
async function fixture(page: Page, gameReduced = false) {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'connection', { value: { saveData: true } }),
  );
  await page.goto(root);
  await expect(page.locator('.slot-card').first()).toBeEnabled();
  await page.evaluate(
    async ({ shared, gameReduced }) => {
      const { newProfile, createCharacterGarden, startWave, resumeSnapshot, snapshot } =
        await import(/* @vite-ignore */ shared);
      const path = '/src/experiments/pinyin-garden/services/saveStore.ts';
      const { saveProfile } = await import(/* @vite-ignore */ path);
      const a = newProfile('A'),
        b = newProfile('B'),
        s = createCharacterGarden('foundation-01', 1, [], 'garden-a-run');
      startWave(s);
      s.nextSpawn = 1e6;
      s.attempts = [
        {
          eventId: 'garden-a-event',
          taskId: 'a',
          entryId: 'symbol-a',
          syllable: 0,
          at: 1,
          correct: true,
          assisted: false,
          repeated: false,
        },
      ];
      a.attempts = s.attempts;
      a.checkpoint = resumeSnapshot(s);
      a.waveStart = snapshot(s);
      a.settings.speech = false;
      b.settings.speech = false;
      a.settings.reducedMotion = gameReduced;
      await saveProfile(0, a);
      await saveProfile(1, b);
    },
    { shared: sharedUrl, gameReduced },
  );
  await page.goto('about:blank');
  await page.goto(root + '#/garden/1/battle/foundation-01');
  await page.getByRole('button', { name: '继续玩', exact: true }).click();
}

test('updating resources after changing gardens never transfers the previous battle', async ({
  page,
}) => {
  await fixture(page);
  await page.getByRole('button', { name: '保存并返回花园' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '切换花园', exact: true }).click();
  await page.locator('.slot-card').nth(1).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '更多游戏设置' }).click();
  await publishResourceUpdate(page);
  await page.getByRole('button', { name: '检查更新', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: '保存并更新花园', exact: true }).click(),
  ]);
  await expect(page.getByRole('heading', { name: '游戏设置', exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const path = '/src/experiments/pinyin-garden/services/saveStore.ts';
        const rows = await (await import(/* @vite-ignore */ path)).exportRawProfiles();
        return rows;
      }),
    )
    .toMatchObject([
      { name: 'A', attempts: [{ eventId: 'garden-a-event' }] },
      { name: 'B', attempts: [], checkpoint: null },
      null,
    ]);
});

test('scene exceptions retain diagnostic context and a new scene can recover', async ({ page }) => {
  await fixture(page);
  await page.getByRole('button', { name: '保存并返回花园' }).click();
  await page.evaluate(async () => {
    const path = '/src/experiments/pinyin-garden/game/entityViews.ts';
    const { EntityViews } = await import(/* @vite-ignore */ path);
    const update = EntityViews.prototype.update;
    EntityViews.prototype.update = function () {
      EntityViews.prototype.update = update;
      throw new TypeError('injected-render-failure');
    };
  });
  await page.getByRole('button', { name: /出发守护|继续守护/ }).click();
  await expect(page.getByRole('heading', { name: '花园还没准备好' })).toBeVisible();
  const diagnostics = await page.evaluate(async () => {
    const path = '/src/resources/manager.ts';
    return (await import(/* @vite-ignore */ path)).resources.diagnostics();
  });
  expect(JSON.stringify(diagnostics)).toContain('scene-runtime-failure');
  expect(JSON.stringify(diagnostics)).toContain('TypeError');
  await page.getByRole('button', { name: '重新准备', exact: true }).click();
  await expect(page.getByRole('button', { name: '继续玩', exact: true })).toBeVisible();
  await expect(page.locator('.game-canvas canvas')).toHaveCount(1);
});

test('retrying a defeated wave resumes the replacement battle state', async ({ page }) => {
  await fixture(page);
  await page.getByRole('button', { name: '保存并返回花园' }).click();
  await page.evaluate(async (shared) => {
    const { newProfile, createCharacterGarden, startWave, resumeSnapshot, snapshot } = await import(
      /* @vite-ignore */ shared
    );
    const path = '/src/experiments/pinyin-garden/services/saveStore.ts';
    const { saveProfile } = await import(/* @vite-ignore */ path);
    const profile = newProfile('重试回归'),
      battle = createCharacterGarden('foundation-01');
    startWave(battle);
    battle.nextSpawn = 12;
    profile.waveStart = snapshot(battle);
    battle.stage = 'lost';
    battle.hearts = 0;
    profile.checkpoint = resumeSnapshot(battle);
    profile.settings.speech = false;
    await saveProfile(0, profile);
  }, sharedUrl);
  await page.goto('about:blank');
  await page.goto(root + '#/garden/1/battle/foundation-01');
  await page.getByRole('button', { name: '重试这一波', exact: true }).click();
  await expect(page.getByRole('heading', { name: '再试一次吧' })).toHaveCount(0);
  await expect(page.locator('.hearts')).toHaveAttribute('aria-label', '爱心 3');
  await expect(page.locator('.deployment-countdown')).toContainText('11 秒', { timeout: 5000 });
});

for (const mode of [
  { name: 'normal', system: false, game: false },
  { name: 'system-reduced', system: true, game: false },
  { name: 'game-reduced', system: false, game: true },
])
  test(`keyboard deployment completes and restores focus (${mode.name})`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ reducedMotion: mode.system ? 'reduce' : 'no-preference' });
    await fixture(page, mode.game);
    if (mode.game) await page.setViewportSize({ width: 844, height: 390 });
    const card = page.locator('.partner-card').filter({ hasText: '露珠收集器' });
    const before = Number(
      (await page.locator('.dew-count').getAttribute('aria-label'))!.replace('露珠 ', ''),
    );
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: '选择部署位置' })).toBeVisible();
    if (mode.game) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: info.outputPath('deployment-narrow.png') });
    }
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowRight');
    const transform = await page
      .getByRole('grid', { name: '可部署空地' })
      .locator('button:focus')
      .evaluate((element) => getComputedStyle(element).transform);
    if (mode.system || mode.game) expect(transform).toBe('none');
    else expect(transform).not.toBe('none');
    await page.keyboard.press('Escape');
    await expect(card).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: '选择部署位置' })).toHaveCount(0);
    await expect(card).toBeFocused();
    await expect(page.locator('.dew-count')).toHaveAttribute('aria-label', `露珠 ${before - 50}`);
    await expect(page.locator('.launch-notice')).toContainText('收集器到位');
    await expect(page.locator('.launch-notice')).toHaveCount(0, { timeout: 6000 });
  });
