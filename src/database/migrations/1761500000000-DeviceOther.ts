import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 목록에 없는 기기("기타")를 직접 입력할 수 있게 한다.
 * - users: OS·모델을 고르지 않고 입력했다면 이름만 저장한다. (고른 값과 입력한 값은 동시에 둘 수 없다)
 * - applications: 신청 당시 OS 사본에 입력한 OS 이름도 들어갈 수 있게 넓힌다.
 */
export class DeviceOther1761500000000 implements MigrationInterface {
  name = 'DeviceOther1761500000000';

  private schema(q: QueryRunner): string {
    return (q.connection.options as { schema?: string }).schema ?? 'testory';
  }

  async up(q: QueryRunner): Promise<void> {
    const s = this.schema(q);
    await q.query(`ALTER TABLE "${s}"."users"
      ADD COLUMN "device_os_name" varchar(30),
      ADD COLUMN "device_model_name" varchar(60),
      ADD CONSTRAINT "ck_users_device_os_one" CHECK ("device_type" IS NULL OR "device_os_name" IS NULL),
      ADD CONSTRAINT "ck_users_device_model_one" CHECK ("device_model_id" IS NULL OR "device_model_name" IS NULL)`);

    await q.query(`ALTER TABLE "${s}"."applications" DROP CONSTRAINT IF EXISTS "applications_device_type_check"`);
    await q.query(`ALTER TABLE "${s}"."applications" ALTER COLUMN "device_type" TYPE varchar(30)`);
  }

  async down(q: QueryRunner): Promise<void> {
    const s = this.schema(q);
    await q.query(`ALTER TABLE "${s}"."applications" ALTER COLUMN "device_type" TYPE varchar(10)`);
    await q.query(
      `ALTER TABLE "${s}"."applications" ADD CONSTRAINT "applications_device_type_check" CHECK ("device_type" IN ('ANDROID','IOS'))`,
    );
    await q.query(`ALTER TABLE "${s}"."users"
      DROP CONSTRAINT "ck_users_device_model_one",
      DROP CONSTRAINT "ck_users_device_os_one",
      DROP COLUMN "device_model_name",
      DROP COLUMN "device_os_name"`);
  }
}
