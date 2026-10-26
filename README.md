# Testory Backend (테스토리 백엔드)

베타테스터 모집·피드백 관리 서비스 **Testory** 의 API 서버입니다. 모집글 하나에 신청과 피드백을 모으고, 정원·기기 조건·취소 같은 **핵심 규칙은 모두 이 서버가 최종적으로 검사**합니다. (화면에서 막아 둔 규칙도 API 를 직접 호출해 우회할 수 없습니다.)

- 기획서: [`기획서.md`](./기획서.md) (프론트엔드 저장소의 `기획서.md` 와 같은 내용)
- 프론트엔드 저장소: `testory-level01-frontend` (이 저장소와 독립)
- 로컬 주소: <http://localhost:4000> · API 문서(Swagger): <http://localhost:4000/api/docs> · Health: <http://localhost:4000/health>

> ⏱ 무료 서버 환경에서는 일정 시간 동안 요청이 없으면 서버가 일시 중지될 수 있어 첫 접속 시 응답이 느릴 수 있습니다. (Render 무료 웹 서비스는 15분 동안 요청이 없으면 잠들고, 다시 깨어나는 데 약 1분 걸립니다.)
>
> ⚠️ Render **무료 PostgreSQL 은 만든 지 30일 뒤 만료**됩니다(14일 유예 후 삭제). 시연이 끝나기 전에 만료되지 않는지 확인하세요.

## 주요 기능

| 구분 | 기능 |
|---|---|
| 인증 | 회원가입(내 기기 포함, 일반 사용자만), 로그인/로그아웃(httpOnly 쿠키 JWT) |
| 내 정보 | 내 정보, **마이페이지에서만** 기기 수정, 기기 모델 선택 목록. 목록에 없는 OS·모델은 "기타"로 직접 입력 |
| 모집글 | 목록(기기·상태 필터, 제목 검색), 상세, 관리자 등록·수정·**Soft Delete**·**복구**·마감/마감 해제, IP 자동 기록, 피드백 마감일, 기기 조건 없음 = 모든 기기 |
| 진행 단계 | 모집 중 → 모집 마감 → 테스트 중 → 피드백 완료 → 분석 완료 → 종료 를 서버가 계산 (테스터에게는 뒤 세 단계를 "피드백 마감"으로 묶음) |
| 신청 | 신청(신청 당시 기기 복사, **정원이 차면 바로 테스트 시작**), 본인 신청 취소, 내 신청 목록, 관리자용 신청자 조회(피드백 수·정렬). 테스터만 |
| 피드백 | 유형(버그/개선/칭찬)을 골라 작성(**테스트 중 ~ 피드백 마감일**), 내 피드백, 관리자 피드백(필터·작성자별 정렬) |
| AI 분석 | 모집글별 GPT 종합 분석 → **버전별 저장**, 이전 버전 조회, 실패 시 저장 안 함, **확인 완료** 표시 |
| 관리자 | 대시보드용 필터(모집 중·마감 임박·AI 분석 필요 등)와 필터별 개수, 시연 데이터 초기화 |

## 기술 스택

NestJS 12 · TypeScript 6 · TypeORM 1.1 · PostgreSQL · zod(환경변수 검증) · class-validator(DTO) · JWT(@nestjs/jwt) · bcryptjs · helmet · @nestjs/throttler · @nestjs/swagger · OpenAI SDK · Vitest + supertest

**ORM 선택 이유(TypeORM)**: Nest 공식 연동(`@nestjs/typeorm`)이 있고 안정판이며, 정원·버전 번호처럼 **행 잠금(`SELECT … FOR UPDATE`)과 트랜잭션이 필요한 규칙**을 직접 쓰기 쉽습니다. Prisma 는 최신(8.x)이 아직 rc 라 제외했습니다.

## 폴더 구조

```
src/
  main.ts, app.module.ts, app.setup.ts   # 부팅, 모듈 조립, 공통 설정(CORS·helmet·검증·오류 형식)
  config/                                # 환경변수 스키마(zod)와 ConfigModule
  common/                                # 가드, 필터, 데코레이터, 열거형, 쉬운 안내 문구
  database/                              # data-source, migrations/, migrate.ts, seed-cli.ts
  modules/
    auth/ users/ recruitments/ applications/ feedbacks/ ai-analyses/ dashboard/ demo/ health/
test/                                    # API 통합(e2e) 테스트
```

각 모듈은 `controller`(요청·응답) → `service`(규칙) → TypeORM(`DataSource`/`Repository`) 순서이며, 불필요한 Repository·Interface 계층은 두지 않았습니다.

## 인증과 권한

- 로그인하면 서버가 **httpOnly 쿠키**(`testory_token`, SameSite=Lax, 운영에서는 Secure)로 JWT 를 내려줍니다. `Authorization: Bearer` 도 받습니다(Swagger·테스트용).
- 전역 `AuthGuard` 가 **요청마다 DB 에서 사용자와 role 을 다시 읽습니다.** 토큰이나 요청 본문의 role·userId 는 믿지 않습니다.
- `@Public()` 이 아닌 API 는 로그인이 필요하고, `@Roles(ADMIN)` 이면 관리자만, `@Roles(USER)` 이면 테스터만 호출할 수 있습니다. 신청·취소·피드백 작성·내 신청·내 피드백은 테스터 전용이고, 취소는 본인 신청만 가능합니다.
- 변경 요청(POST/PATCH/DELETE)은 `Origin` 이 `FRONTEND_URL` 에 없으면 거절하고, 로그인·가입은 요청 횟수를 제한합니다.
- 비밀번호는 bcrypt 로 해시해 저장합니다.

## API 요약 (자세한 요청 형식은 Swagger)

| 구분 | 경로 | 누가 |
|---|---|---|
| 확인 | `GET /health` | 누구나 |
| 인증 | `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout` | 누구나 |
| 내 정보 | `GET /me`, `PATCH /me/device`, `GET /device-models?os=` | 로그인 / 본인 / 누구나 |
| 모집글 | `GET /recruitments`(`os`,`status`,`q`,`page`,`limit`), `GET /recruitments/:id` | 누구나 |
| 모집글 관리 | `GET·POST /admin/recruitments`(`deleted`=exclude·include·only, `stage`, `filter`, `os`, `status`, `q`, `page`, `limit`), `GET·PATCH·DELETE /admin/recruitments/:id`, `PATCH …/:id/close`, `PATCH …/:id/reopen`, `PATCH …/:id/restore` | 관리자 |
| 신청 | `POST /recruitments/:id/applications`, `DELETE /applications/:id`, `GET /me/applications` | 테스터 |
| 신청자 | `GET /admin/recruitments/:id/applications?sort=feedback_desc` | 관리자 |
| 피드백 | `POST /recruitments/:id/feedbacks`, `GET /me/feedbacks?recruitmentId=`, `GET /admin/feedbacks`(`recruitmentId`, `type`, `sort=author_count_desc`) | 참여 중 테스터 / 본인 / 관리자 |
| AI 분석 | `POST·GET /admin/recruitments/:id/analyses`, `GET …/analyses/latest｜:version`, `POST …/analyses/review`(확인 완료) | 관리자 |
| 현황·시연 | `GET /admin/dashboard`(단계별 개수), `POST /admin/demo/reset` | 관리자 |

- 관리자 목록 응답에는 `filterCounts`(전체·모집 중·마감 임박·테스트 중·AI 분석 필요·분석 완료·종료·삭제)와 `stageCounts` 가 함께 옵니다. 프론트 대시보드의 숫자 카드와 필터 칩은 이 값을 씁니다. `GET /admin/dashboard` 는 남아 있지만 지금 프론트는 쓰지 않습니다.
- `filter` 기준: 마감 임박 = 모집 중이면서 모집 마감일이 7일 안이거나 남은 자리가 1명, AI 분석 필요 = 피드백 마감이 지났고 피드백이 있는데 분석이 없음, 종료 = 확인 완료했거나 피드백 0건으로 피드백 마감이 지남, 삭제 = 삭제된 글만.
- `PATCH …/:id/restore` 는 삭제한 글을 되살립니다. `deleted_at`·`deleted_ip` 를 **비우고** 요청 IP 를 `updated_ip` 에 기록하므로 이전 삭제 기록은 남지 않습니다. 삭제되지 않은 글이면 404 입니다.

오류는 항상 `{ statusCode, code, message, details? }` 형식이고 `message` 는 화면에 그대로 보여 줄 수 있는 쉬운 한국어입니다.

## 규칙(R1~R16)을 지키는 방법

| 규칙 | 구현 |
|---|---|
| R1 정원 1~50 / 동시 신청 | DTO 검증 + DB `CHECK` + 모집글 행 잠금(`FOR UPDATE`) 트랜잭션 안에서 인원 확인 |
| R2 자동 마감 | 상태를 저장하지 않고 `관리자 마감 / 정원 참 / 시작됨`으로 계산. 신청으로 정원이 차면(또는 시작 전 정원을 참여자 수만큼 줄이면) 같은 트랜잭션에서 `test_started_at` 을 기록해 **바로 테스트를 시작** |
| R3 중복 신청 금지 | 서비스 검사 + 부분 유니크 인덱스(`status='APPLIED'`) |
| R4 시작 후 신청·취소 금지 | 잠금 트랜잭션 안에서 시각 확인. 시작 시각 = `start_at` 과 `test_started_at` 중 빠른 쪽 |
| R5/R6 기기 조건·복사 | 신청 시 서버가 내 정보의 기기를 읽어 조건과 비교하고 신청 표에 복사 (요청의 기기 값은 무시). 조건이 없으면 모든 기기, 직접 입력한 모델은 OS 와 모델명(대소문자·공백 무시)으로 비교, 직접 입력한 OS 는 모든 기기 모집에만 맞음 |
| R7 기기 수정 | `PATCH /me/device` 만 가능, 목록의 모델·OS 일치 확인. "기타"는 `deviceType=OTHER` + `deviceOsName`, 또는 `deviceModelName` 으로 받고 DB `CHECK` 로 고른 값·입력한 값을 동시에 못 둠 |
| R8 기기 조건 겹침 금지 | 서비스 검사 + 부분 유니크 인덱스 + `CHECK`(특정 모델 조건은 `device_model_id`·`model_name` 중 하나만). 빈 배열 = 모든 기기 |
| R9 피드백 | 참여 중인 사람만, 테스트 시작 ~ `feedback_due_at` 사이만, 유형 필수. `feedback_due_at >= end_at` 은 DB `CHECK` 로도 막음 |
| R10 정원 축소 | 잠금 트랜잭션 안에서 현재 참여자 수와 비교 |
| R11 Soft Delete·복구 | `deleted_at/deleted_ip` 만 기록, 모든 사용자 조회·신청·피드백·분석 실행·현황에서 제외. 복구는 두 칸을 비우고 `updated_ip` 기록 |
| R12 IP 기록 | `trust proxy` 설정 후 서버가 요청에서 읽음 (수정·마감·마감 해제·복구는 `updated_ip`) |
| R13/R14 AI 분석 | 피드백 0건이면 GPT 미호출, 키가 없으면 503 안내, 성공 시에만 `MAX(version_no)+1` 저장, 서버 단위 중복 호출 방지, DB 트리거로 수정·삭제 차단 |
| R15 역할 | 전역 가드 + `@Roles(ADMIN｜USER)` |
| R16 시연 초기화 | PostgreSQL advisory lock (`pg_try_advisory_lock`), 실행 중이면 409 |
| R17 진행 단계 | `computeStage()`(응답용)와 같은 규칙의 SQL `CASE` 식(필터·개수용)으로 계산, 저장하지 않음 |
| R18 분석 확인 완료 | 분석이 있을 때만 `analysis_reviewed_at` 기록. 최신 분석 시각보다 늦으면 "종료" |

## 환경변수

| 이름 | 필수 | 설명 / 형식 | 로컬 · 운영 | 민감 |
|---|---|---|---|---|
| `DATABASE_URL` | 예 | `postgresql://사용자:비밀번호@호스트/DB이름` (Render External URL) | 로컬·운영 모두 같은 형식 | **예** |
| `DATABASE_SCHEMA` | 아니오(기본 `testory`) | 이 앱 전용 스키마 이름(소문자·숫자·`_`). 같은 DB 를 다른 과제와 나눠 쓸 때 섞이지 않게 함 | 동일 | 아니오 |
| `DATABASE_SSL` | 아니오 | 비우면 localhost 가 아닐 때 자동으로 SSL. `true`/`false` 로 강제 | 로컬 DB 는 자동으로 꺼짐 | 아니오 |
| `JWT_SECRET` | 예 | 16자 이상 랜덤 문자열 (`openssl rand -hex 32`) | 운영은 Render 가 생성 | **예** |
| `JWT_EXPIRES_IN` | 아니오(7d) | `7d`, `12h` 등 | 동일 | 아니오 |
| `FRONTEND_URL` | 예 | 허용할 프론트엔드 주소, 쉼표로 여러 개. 예: `https://testory.vercel.app` | 로컬 `http://localhost:3000` | 아니오 |
| `GPT_API_KEY` | AI 분석에 필요 | OpenAI API 키. **백엔드에서만 사용** | 로컬 `.env`, 운영 Render 환경변수 | **예** |
| `GPT_MODEL` | 아니오(gpt-4o-mini) | 사용할 모델 이름 | 동일 | 아니오 |
| `PORT` | 아니오(4000) | Render 가 자동 주입 | | 아니오 |
| `NODE_ENV` | 아니오 | 운영은 `production` | | 아니오 |
| `DEMO_SEED_ENABLED` | 운영에서 시연 데이터를 쓸 때 | `true` 여야 운영에서 시드·초기화 버튼이 동작 | 로컬은 불필요 | 아니오 |
| `DEMO_PASSWORD` | 운영에서 시연 데이터를 쓸 때 | 데모 계정 비밀번호. 비우면 로컬 기본값을 쓰고 **운영에서는 반드시 직접 지정** | | **예** |

`.env.example` 을 복사해 `.env` 를 만들고 값을 채웁니다. `.env` 는 Git 에 올라가지 않습니다.

## 로컬 실행

```bash
npm ci
cp .env.example .env     # DATABASE_URL, JWT_SECRET 등을 채우기
npm run build
npm run migration:run    # 스키마와 기기 모델 기본 목록 생성 (데이터를 지우지 않음)
npm run seed             # 시연 데이터 생성 (관리자 1, 테스터 20, 모집글 10(삭제 1 포함), 피드백 36, AI 분석 3)
npm run start:dev        # http://localhost:4000
```

- 마이그레이션은 **아직 실행하지 않은 것만** 순서대로 실행하며 `synchronize` 는 쓰지 않습니다. 실행 전 `src/database/migrations/` 의 SQL 을 확인하세요. 현재 상태는 `npm run migration:show`.
- `npm run seed` / 관리자 화면의 "시연 데이터 초기화"는 **테스터·모집글·신청·피드백·AI 분석을 지우고 다시 만듭니다.** 관리자 계정과 기기 모델 목록은 남깁니다. 운영(`NODE_ENV=production`)에서는 `DEMO_SEED_ENABLED=true` 와 `DEMO_PASSWORD` 를 직접 정했을 때만 동작합니다.
- 날짜는 실행 시점 기준으로 계산하므로 언제 눌러도 같은 진행 단계(모집 중·마감 임박·모집 마감·테스트 중·AI 분석 필요·분석 완료·종료·삭제)가 그대로 나옵니다. 모집글별 시연 목적은 기획서 9장에 있습니다.

### 데모 계정 (시연 데이터에서 만들어지는 가짜 계정)

| 역할 | 이메일 | 비밀번호(로컬 기본값) |
|---|---|---|
| 관리자 | `admin@testory.demo` | `testory-demo-1234` |
| 일반 사용자 | `tester01@testory.demo` ~ `tester20@testory.demo` | `testory-demo-1234` |

운영에서는 `DEMO_PASSWORD` 로 지정한 비밀번호가 쓰입니다. 운영 관리자 비밀번호·Secret 은 README 에 적지 않습니다.

## 테스트와 빌드

```bash
npm test          # 단위 테스트 (규칙 함수 등)
npm run test:e2e  # API 통합 테스트 — 실제 PostgreSQL 에 테스트 전용 스키마를 만들었다가 지움
npm run lint      # 타입 검사 (tsc --noEmit)
npm run build     # dist/ 생성
```

- e2e 는 `TEST_DATABASE_URL`(예: 로컬 임시 PostgreSQL)이 있으면 그것을, 없으면 `.env` 의 `DATABASE_URL` 에 `testory_test_xxxx` 스키마를 만들어 실행하고 끝나면 삭제합니다. 원격 무료 DB 는 연결이 불안정할 수 있어 로컬 DB 사용을 권장합니다.
- 테스트는 GPT 를 호출하지 않습니다(가짜 클라이언트 사용).

## Render 배포

| 항목 | 값 |
|---|---|
| 서비스 종류 | Web Service (Blueprint: `render.yaml`) |
| Root Directory | 저장소 루트(비움) |
| Runtime / Node | Node, `NODE_VERSION=22.12.0` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm run migration:run && npm run start:prod` |
| Health Check Path | `/health` |
| 포트 | Render 의 `PORT` 를 사용하고 `0.0.0.0` 에 바인딩 |

1. Render 에서 PostgreSQL 을 만들고 **External Database URL** 을 복사합니다(지역은 웹 서비스와 같게).
2. 이 저장소를 Blueprint 로 연결하고 `DATABASE_URL`, `FRONTEND_URL`(Vercel 주소), `GPT_API_KEY`, `DEMO_PASSWORD` 를 입력합니다.
3. 첫 배포 때 시작 명령이 마이그레이션을 먼저 실행합니다. 마이그레이션은 새 테이블을 추가하는 방식이라 기존 데이터를 지우지 않습니다. 데이터를 지우거나 바꾸는 마이그레이션을 추가할 때는 배포 전에 따로 검토하세요.
4. 첫 시연 데이터는 로컬에서 같은 DB 로 `npm run seed` 를 실행하거나, 관리자 로그인 후 "시연 데이터" 화면에서 만들 수 있습니다(운영에서는 `DEMO_SEED_ENABLED=true` 필요). 관리자 계정이 아직 없으면 시드가 만듭니다.
5. 프론트엔드는 Vercel 의 rewrite 로 이 서버를 같은 오리진처럼 호출하므로 쿠키가 1st-party 로 동작합니다. `FRONTEND_URL` 에는 Vercel 주소(미리보기 주소가 필요하면 쉼표로 추가)를 넣습니다.

배포 주소: _(배포 후 여기에 입력)_
