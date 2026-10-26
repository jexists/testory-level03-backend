import type { MigrationInterface, QueryRunner } from 'typeorm';

/** 모집 종류(앱 전체/기능별)를 더 쓰지 않아 컬럼을 지운다. 되돌리면 기존 글은 "기능별"로 채운다. */
export class DropRecruitmentKind1761800000000 implements MigrationInterface {
  name = 'DropRecruitmentKind1761800000000';

  private schema(q: QueryRunner): string {
    return (q.connection.options as { schema?: string }).schema ?? 'testory';
  }

  async up(q: QueryRunner): Promise<void> {
    const s = this.schema(q);
    await q.query(`ALTER TABLE "${s}"."recruitments" DROP COLUMN "kind"`);
  }

  async down(q: QueryRunner): Promise<void> {
    const s = this.schema(q);
    await q.query(`ALTER TABLE "${s}"."recruitments"
      ADD COLUMN "kind" varchar(12) NOT NULL DEFAULT 'FEATURE' CHECK ("kind" IN ('APP_FULL','FEATURE'))`);
    await q.query(`ALTER TABLE "${s}"."recruitments" ALTER COLUMN "kind" DROP DEFAULT`);
  }
}
