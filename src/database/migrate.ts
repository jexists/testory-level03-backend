import dataSource from './data-source';

/**
 * 아직 실행하지 않은 마이그레이션만 순서대로 실행한다. 스키마가 없으면 먼저 만든다.
 * 데이터를 지우는 동작은 없다. (npm run migration:run)
 */
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL 이 필요해요.');
  await dataSource.initialize();
  try {
    const schema = (dataSource.options as { schema: string }).schema;
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    const pending = await dataSource.showMigrations();
    console.log(pending ? '실행할 마이그레이션이 있어요.' : '이미 최신 상태예요.');
    const ran = await dataSource.runMigrations({ transaction: 'each' });
    for (const m of ran) console.log(`적용: ${m.name}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
