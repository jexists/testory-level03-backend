import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 모집 기기 조건에서 목록에 없는 모델을 "기타"로 직접 입력할 수 있게 한다.
 * 특정 모델 조건은 device_model_id 또는 model_name 중 하나만 채운다.
 */
export class RecruitmentDeviceOther1761700000000 implements MigrationInterface {
  name = 'RecruitmentDeviceOther1761700000000';

  private schema(q: QueryRunner): string {
    return (q.connection.options as { schema?: string }).schema ?? 'testory';
  }

  async up(q: QueryRunner): Promise<void> {
    const s = this.schema(q);
    await q.query(`ALTER TABLE "${s}"."recruitment_devices"
      ADD COLUMN "model_name" varchar(100),
      DROP CONSTRAINT "ck_recruitment_devices_scope",
      ADD CONSTRAINT "ck_recruitment_devices_scope" CHECK (
        ("scope" = 'ALL' AND "device_model_id" IS NULL AND "model_name" IS NULL)
        OR ("scope" = 'MODEL' AND ("device_model_id" IS NULL) <> ("model_name" IS NULL))
      )`);
  }

  async down(q: QueryRunner): Promise<void> {
    const s = this.schema(q);
    await q.query(`DELETE FROM "${s}"."recruitment_devices" WHERE "scope" = 'MODEL' AND "device_model_id" IS NULL`);
    await q.query(`ALTER TABLE "${s}"."recruitment_devices"
      DROP CONSTRAINT "ck_recruitment_devices_scope",
      DROP COLUMN "model_name",
      ADD CONSTRAINT "ck_recruitment_devices_scope" CHECK (
        ("scope" = 'ALL' AND "device_model_id" IS NULL) OR ("scope" = 'MODEL' AND "device_model_id" IS NOT NULL)
      )`);
  }
}
