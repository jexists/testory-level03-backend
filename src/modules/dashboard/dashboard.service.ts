import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** A1 현황: 모두 그때그때 COUNT 로 센다 (R11: 삭제된 모집글 제외). */
@Injectable()
export class DashboardService {
  constructor(@InjectDataSource() private ds: DataSource) {}

  async summary() {
    const [s] = await this.ds.query(`
      select
        (select count(distinct a.user_id) from applications a join recruitments r on r.id = a.recruitment_id
          where a.status = 'APPLIED' and r.deleted_at is null)::int as participants,
        (select count(*) from feedbacks f join recruitments r on r.id = f.recruitment_id where r.deleted_at is null)::int as feedbacks,
        (select count(*) from feedbacks f join recruitments r on r.id = f.recruitment_id
          where r.deleted_at is null and f.type = 'BUG')::int as bugs`);
    const rows = await this.ds.query(`
      select r.id, r.title,
        (select count(*) from applications a where a.recruitment_id = r.id and a.status = 'APPLIED')::int as participants,
        (select count(*) from feedbacks f where f.recruitment_id = r.id)::int as feedbacks
      from recruitments r where r.deleted_at is null order by r.id desc`);
    return { ...s, recruitments: rows };
  }
}
