import type { MigrationInterface, QueryRunner } from 'typeorm';

/** 기획서 6장의 테이블 7개. 기기 모델 기본 목록은 가입 화면이 비지 않도록 함께 넣는다. */
export class InitSchema1761400000000 implements MigrationInterface {
  name = 'InitSchema1761400000000';

  private schema(q: QueryRunner): string {
    return (q.connection.options as { schema?: string }).schema ?? 'testory';
  }

  async up(q: QueryRunner): Promise<void> {
    const s = this.schema(q);
    await q.query(`CREATE SCHEMA IF NOT EXISTS "${s}"`);

    await q.query(`CREATE TABLE "${s}"."device_models" (
      "id" SERIAL PRIMARY KEY,
      "os" varchar(10) NOT NULL CHECK ("os" IN ('ANDROID','IOS')),
      "model_name" varchar(60) NOT NULL,
      "is_active" boolean NOT NULL DEFAULT true,
      CONSTRAINT "uq_device_models_os_name" UNIQUE ("os","model_name")
    )`);

    await q.query(`CREATE TABLE "${s}"."users" (
      "id" SERIAL PRIMARY KEY,
      "email" varchar(255) NOT NULL UNIQUE,
      "password_hash" varchar(100) NOT NULL,
      "nickname" varchar(30) NOT NULL,
      "role" varchar(10) NOT NULL DEFAULT 'USER' CHECK ("role" IN ('ADMIN','USER')),
      "device_type" varchar(10) CHECK ("device_type" IN ('ANDROID','IOS')),
      "device_model_id" int REFERENCES "${s}"."device_models"("id"),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);

    await q.query(`CREATE TABLE "${s}"."recruitments" (
      "id" SERIAL PRIMARY KEY,
      "title" varchar(100) NOT NULL,
      "description" text NOT NULL,
      "kind" varchar(12) NOT NULL CHECK ("kind" IN ('APP_FULL','FEATURE')),
      "capacity" int NOT NULL DEFAULT 15 CHECK ("capacity" BETWEEN 1 AND 50),
      "start_at" timestamptz NOT NULL,
      "end_at" timestamptz NOT NULL,
      "is_closed" boolean NOT NULL DEFAULT false,
      "created_by" int NOT NULL REFERENCES "${s}"."users"("id"),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "created_ip" varchar(64),
      "updated_ip" varchar(64),
      "deleted_at" timestamptz,
      "deleted_ip" varchar(64),
      CONSTRAINT "ck_recruitments_period" CHECK ("end_at" > "start_at")
    )`);
    await q.query(`CREATE INDEX "ix_recruitments_deleted_at" ON "${s}"."recruitments" ("deleted_at")`);

    await q.query(`CREATE TABLE "${s}"."recruitment_devices" (
      "id" SERIAL PRIMARY KEY,
      "recruitment_id" int NOT NULL REFERENCES "${s}"."recruitments"("id"),
      "os" varchar(10) NOT NULL CHECK ("os" IN ('ANDROID','IOS')),
      "scope" varchar(10) NOT NULL CHECK ("scope" IN ('ALL','MODEL')),
      "device_model_id" int REFERENCES "${s}"."device_models"("id"),
      "device_capacity" int,
      CONSTRAINT "ck_recruitment_devices_scope" CHECK (
        ("scope" = 'ALL' AND "device_model_id" IS NULL) OR ("scope" = 'MODEL' AND "device_model_id" IS NOT NULL)
      )
    )`);
    await q.query(
      `CREATE UNIQUE INDEX "uq_recruitment_devices_all" ON "${s}"."recruitment_devices" ("recruitment_id","os") WHERE "scope" = 'ALL'`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "uq_recruitment_devices_model" ON "${s}"."recruitment_devices" ("recruitment_id","device_model_id") WHERE "scope" = 'MODEL'`,
    );

    await q.query(`CREATE TABLE "${s}"."applications" (
      "id" SERIAL PRIMARY KEY,
      "recruitment_id" int NOT NULL REFERENCES "${s}"."recruitments"("id"),
      "user_id" int NOT NULL REFERENCES "${s}"."users"("id"),
      "device_type" varchar(10) NOT NULL CHECK ("device_type" IN ('ANDROID','IOS')),
      "device_model" varchar(60) NOT NULL,
      "status" varchar(10) NOT NULL DEFAULT 'APPLIED' CHECK ("status" IN ('APPLIED','CANCELLED')),
      "applied_at" timestamptz NOT NULL DEFAULT now(),
      "cancelled_at" timestamptz
    )`);
    // 같은 사람이 같은 모집글에 "참여 중" 신청을 2개 가질 수 없다. (R3)
    await q.query(
      `CREATE UNIQUE INDEX "uq_applications_active" ON "${s}"."applications" ("recruitment_id","user_id") WHERE "status" = 'APPLIED'`,
    );
    await q.query(`CREATE INDEX "ix_applications_recruitment_status" ON "${s}"."applications" ("recruitment_id","status")`);
    await q.query(`CREATE INDEX "ix_applications_user" ON "${s}"."applications" ("user_id")`);

    await q.query(`CREATE TABLE "${s}"."feedbacks" (
      "id" SERIAL PRIMARY KEY,
      "recruitment_id" int NOT NULL REFERENCES "${s}"."recruitments"("id"),
      "user_id" int NOT NULL REFERENCES "${s}"."users"("id"),
      "type" varchar(12) NOT NULL CHECK ("type" IN ('BUG','IMPROVEMENT','PRAISE')),
      "title" varchar(100) NOT NULL,
      "content" text NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX "ix_feedbacks_recruitment" ON "${s}"."feedbacks" ("recruitment_id","created_at")`);
    await q.query(`CREATE INDEX "ix_feedbacks_user" ON "${s}"."feedbacks" ("user_id","recruitment_id")`);

    await q.query(`CREATE TABLE "${s}"."ai_analyses" (
      "id" SERIAL PRIMARY KEY,
      "recruitment_id" int NOT NULL REFERENCES "${s}"."recruitments"("id"),
      "version_no" int NOT NULL,
      "result" jsonb NOT NULL,
      "feedback_count" int NOT NULL,
      "model_name" varchar(60) NOT NULL,
      "created_by" int NOT NULL REFERENCES "${s}"."users"("id"),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "uq_ai_analyses_version" UNIQUE ("recruitment_id","version_no")
    )`);

    // 이전 버전을 고치거나 지울 수 없도록 DB 에서도 막는다. (R14)
    await q.query(`CREATE FUNCTION "${s}"."forbid_ai_analysis_change"() RETURNS trigger AS $$
      BEGIN
        -- 시연 데이터 초기화(트랜잭션 안에서 testory.demo_reset=on)일 때만 삭제를 허용한다.
        IF TG_OP = 'DELETE' AND current_setting('testory.demo_reset', true) = 'on' THEN RETURN OLD; END IF;
        RAISE EXCEPTION 'ai_analyses 는 수정하거나 삭제할 수 없어요.';
      END; $$ LANGUAGE plpgsql`);
    await q.query(`CREATE TRIGGER "tg_ai_analyses_immutable" BEFORE UPDATE OR DELETE ON "${s}"."ai_analyses"
      FOR EACH ROW EXECUTE FUNCTION "${s}"."forbid_ai_analysis_change"()`);

    await q.query(`INSERT INTO "${s}"."device_models" ("os","model_name") VALUES
      ('ANDROID','갤럭시 S24'),('ANDROID','갤럭시 S23'),('ANDROID','갤럭시 A54'),('ANDROID','픽셀 8'),('ANDROID','픽셀 7a'),
      ('IOS','아이폰 15'),('IOS','아이폰 15 Pro'),('IOS','아이폰 14'),('IOS','아이폰 SE (3세대)')
      ON CONFLICT DO NOTHING`);
  }

  async down(q: QueryRunner): Promise<void> {
    const s = this.schema(q);
    await q.query(`DROP TRIGGER IF EXISTS "tg_ai_analyses_immutable" ON "${s}"."ai_analyses"`);
    for (const t of ['ai_analyses', 'feedbacks', 'applications', 'recruitment_devices', 'recruitments', 'users', 'device_models']) {
      await q.query(`DROP TABLE IF EXISTS "${s}"."${t}"`);
    }
    await q.query(`DROP FUNCTION IF EXISTS "${s}"."forbid_ai_analysis_change"()`);
  }
}
