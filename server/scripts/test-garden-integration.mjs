import { spawnSync } from 'node:child_process';

if (!process.env.MYSQL_DATABASE?.endsWith('_test')) {
  console.error('Integration tests require an explicit MYSQL_DATABASE ending in _test.');
  process.exit(1);
}
const result = spawnSync(
  process.execPath,
  ['../node_modules/vitest/vitest.mjs', 'run', 'test/garden-site.integration.test.ts'],
  { stdio: 'inherit', env: { ...process.env, GARDEN_DB_TEST: '1' } },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
