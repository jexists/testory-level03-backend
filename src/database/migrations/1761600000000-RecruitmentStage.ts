import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 관리자 진행 단계(모집 중 → … → 종료)를 계산하는 데 필요한 값을 더한다.
 * - feedback_due_at: 피드백 마감일. 기존 글은 종료일 + 3일
 * - test_started_at: 정원이 차서 테스트가 일찍 시작된 시각
 * - analysis_reviewed_at: 관리자가 AI 분석을 확인 완료한 시각
 */
export class RecruitmentStage1761600000000 implements MigrationInterface {
  name = 'RecruitmentStage1761600000000';

  private schema(q: QueryRunner): string {
    return (q.connection.options as { schema?: string }).schema ?? 'testory';
  }

  async up(q: QueryRunner): Promise<void> {
    const s = this.schema(q);
    await q.query(`ALTER TABLE "${s}"."recruitments"
      ADD COLUMN "feedback_due_at" timestamptz,
      ADD COLUMN "test_started_at" timestamptz,
      ADD COLUMN "analysis_reviewed_at" timestamptz`);
    await q.query(`UPDATE "${s}"."recruitments" SET "feedback_due_at" = "end_at" + interval '3 days'`);
    await q.query(`ALTER TABLE "${s}"."recruitments"
      ALTER COLUMN "feedback_due_at" SET NOT NULL,
      ADD CONSTRAINT "ck_recruitments_feedback_due" CHECK ("feedback_due_at" >= "end_at")`);
  }

  async down(q: QueryRunner): Promise<void> {
    const s = this.schema(q);
    await q.query(`ALTER TABLE "${s}"."recruitments"
      DROP CONSTRAINT "ck_recruitments_feedback_due",
      DROP COLUMN "analysis_reviewed_at",
      DROP COLUMN "test_started_at",
      DROP COLUMN "feedback_due_at"`);
  }
}
