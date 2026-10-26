<div align="center">

# Testory · Backend

**앱 베타테스터 모집 · 신청 · 피드백 관리 서비스의 API 서버**

<a href="https://testory-level01-frontend.vercel.app"><img src="https://img.shields.io/badge/배포_앱_열기-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="배포 앱 열기"></a>
<a href="https://testory-level01-backend.onrender.com/api/docs"><img src="https://img.shields.io/badge/API_문서-85EA2D?style=for-the-badge&logo=swagger&logoColor=black" alt="API 문서"></a>
<a href="./기획서.md"><img src="https://img.shields.io/badge/기획서-2F5BEA?style=for-the-badge&logo=markdown&logoColor=white" alt="기획서"></a>

![NestJS](https://img.shields.io/badge/NestJS_12-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript_6-3178C6?style=flat-square&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square)
![Render](https://img.shields.io/badge/Render-46E3B7?style=flat-square&logo=render&logoColor=black)

</div>

---

## 🔗 바로가기

| 구분 | GitHub 저장소 | 배포 주소 |
|---|---|---|
| **프론트엔드** | [jexists/testory-level01-frontend](https://github.com/jexists/testory-level01-frontend) | <https://testory-level01-frontend.vercel.app> |
| **백엔드** (이 저장소) | [jexists/testory-level01-backend](https://github.com/jexists/testory-level01-backend) | <https://testory-level01-backend.onrender.com> |

| 확인용 주소 | 배포 | 로컬 |
|---|---|---|
| Health (DB 연결 확인) | [/health](https://testory-level01-backend.onrender.com/health) | <http://localhost:4000/health> |
| API 문서 (Swagger) | [/api/docs](https://testory-level01-backend.onrender.com/api/docs) | <http://localhost:4000/api/docs> |

- 확인용 계정: [프론트엔드 README](https://github.com/jexists/testory-level01-frontend#accounts)
- 기획서: [`기획서.md`](./기획서.md) (프론트엔드 저장소와 동일)

> ⏱ **무료 서버 안내** — Render 무료 웹 서비스는 15분 미사용 시 절전. 첫 접속 응답 최대 약 1분 소요, 고장 아님.
>
> ⚠️ Render 무료 PostgreSQL = 생성 후 30일 만료 (14일 유예 후 삭제). 시연 전 만료일 확인.

---

## ✨ 주요 기능

| 구분 | 기능 |
|---|---|
| 인증 | 회원가입(내 기기 포함), 로그인·로그아웃 (httpOnly 쿠키 JWT) |
| 내 정보 | 내 정보 조회, 기기 수정(마이페이지 전용), 기기 모델 목록, 목록 외 OS·모델 직접 입력 |
| 모집글 | 목록(기기·상태 필터, 제목 검색), 상세, 등록·수정·Soft Delete·복구·마감·마감 해제, IP 기록 |
| 진행 단계 | 모집 중 → 모집 마감 → 테스트 중 → 피드백 완료 → 분석 완료 → 종료, 서버 계산 |
| 신청 | 신청(당시 기기 복사, 정원 충족 시 즉시 테스트 시작), 본인 취소, 내 신청, 신청자 조회(피드백 수 정렬) |
| 피드백 | 유형(버그·개선·칭찬) 선택 작성, 테스트 시작 ~ 피드백 마감일 한정, 관리자 필터·정렬 |
| AI 분석 | GPT 3단계 분석(요약 → 웹 참고자료 → 조치 판단), 근거 피드백 연결, 버전별 저장, 확인 완료, 진행 상황 SSE |
| 관리자 | 대시보드 필터·개수, 시연 데이터 초기화 |

---

## 🛠 기술 스택

| 구분 | 기술 |
|---|---|
| Framework | ![NestJS](https://img.shields.io/badge/NestJS_12-E0234E?style=flat-square&logo=nestjs&logoColor=white) |
| Language | ![TypeScript](https://img.shields.io/badge/TypeScript_6-3178C6?style=flat-square&logo=typescript&logoColor=white) |
| Database | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white) ![TypeORM](https://img.shields.io/badge/TypeORM_1.1-FE0803?style=flat-square&logo=typeorm&logoColor=white) |
| Auth · Security | ![JWT](https://img.shields.io/badge/JWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white) ![bcrypt](https://img.shields.io/badge/bcryptjs-338033?style=flat-square) ![Helmet](https://img.shields.io/badge/Helmet-1F2937?style=flat-square) ![Throttler](https://img.shields.io/badge/Throttler-E0234E?style=flat-square&logo=nestjs&logoColor=white) |
| Validation | ![class-validator](https://img.shields.io/badge/class--validator-5A67D8?style=flat-square) ![Zod](https://img.shields.io/badge/Zod_(환경변수)-3E67B1?style=flat-square&logo=zod&logoColor=white) |
| API Docs | ![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=flat-square&logo=swagger&logoColor=black) |
| AI | ![OpenAI](https://img.shields.io/badge/OpenAI_SDK-412991?style=flat-square) |
| Test | ![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white) ![Supertest](https://img.shields.io/badge/Supertest-333333?style=flat-square) |
| Deploy | ![Render](https://img.shields.io/badge/Render-46E3B7?style=flat-square&logo=render&logoColor=black) |

---

## 🔐 인증 · 권한

- 로그인 토큰: httpOnly 쿠키 `testory_token` (SameSite=Lax, 운영 Secure), `Authorization: Bearer` 도 허용
- 요청마다 DB 에서 사용자·역할 재조회 (토큰·요청 본문의 역할 무시)
- 역할 구분: `@Public()` 누구나 · `@Roles(ADMIN)` 관리자 · `@Roles(USER)` 테스터
- 변경 요청(POST·PATCH·DELETE): `FRONTEND_URL` 외 Origin 거절
- 로그인·가입: IP당 1분 10회 제한, 비밀번호 bcrypt 해시

---

## 📡 API

오류 응답 형식: `{ statusCode, code, message, details? }` — `message` 는 화면에 바로 보여 줄 한국어 안내

<details>
<summary><b>API 목록 펼치기</b> (요청 형식 상세는 Swagger)</summary>

| 구분 | 경로 | 권한 |
|---|---|---|
| 확인 | `GET /health` | 누구나 |
| 인증 | `POST /auth/signup` · `/auth/login` · `/auth/logout` | 누구나 |
| 내 정보 | `GET /me`, `PATCH /me/device`, `GET /device-models?os=` | 로그인 / 본인 / 누구나 |
| 모집글 | `GET /recruitments` (`os`, `status`, `q`, `page`, `limit`), `GET /recruitments/:id` | 누구나 |
| 모집글 관리 | `GET·POST /admin/recruitments` (`deleted`, `stage`, `filter`, `os`, `status`, `q`), `GET·PATCH·DELETE /admin/recruitments/:id`, `PATCH …/:id/close` · `/reopen` · `/restore` | 관리자 |
| 신청 | `POST /recruitments/:id/applications`, `DELETE /applications/:id`, `GET /me/applications` | 테스터 |
| 신청자 | `GET /admin/recruitments/:id/applications?sort=feedback_desc` | 관리자 |
| 피드백 | `POST /recruitments/:id/feedbacks`, `GET /me/feedbacks`, `GET /admin/feedbacks` (`recruitmentId`, `type`, `sort`) | 참여 테스터 / 본인 / 관리자 |
| AI 분석 | `POST·GET /admin/recruitments/:id/analyses`, `POST …/analyses/stream` (SSE), `GET …/analyses/latest` · `/:version`, `POST …/analyses/review` | 관리자 |
| 시연 | `POST /admin/demo/reset` | 관리자 |

</details>

---

## 📏 핵심 규칙

백엔드 최종 검사 → API 직접 호출로도 우회 불가. 전체 18개 규칙은 [기획서 7장](./기획서.md) 참고.

| 규칙 | 구현 |
|---|---|
| 정원 1~50, 동시 신청 | DTO 검증 + DB `CHECK` + 모집글 행 잠금(`FOR UPDATE`) 트랜잭션 |
| 정원 충족 시 자동 마감 | 같은 트랜잭션에서 `test_started_at` 기록 → 즉시 테스트 시작 |
| 중복 신청 금지 | 서비스 검사 + 부분 유니크 인덱스 |
| 테스트 시작 후 신청·취소 금지 | 잠금 트랜잭션 안 시각 확인 |
| 기기 조건 일치 | 서버가 내 기기 조회·비교 후 신청에 복사 (요청 값 무시) |
| 피드백 기간 | 참여 테스터 한정, 테스트 시작 ~ `feedback_due_at` |
| Soft Delete · 복구 | `deleted_at`·`deleted_ip` 기록, 모든 조회에서 제외 |
| AI 분석 | 피드백 0건 시 미호출, 성공 시에만 새 버전 저장, 중복 실행 방지, 트리거로 수정·삭제 차단 |
| 시연 초기화 | PostgreSQL advisory lock, 실행 중이면 409 |

---

## 🚀 시작하기

**사전 준비:** Node.js 22.12 이상, PostgreSQL

```bash
npm ci
cp .env.example .env        # DATABASE_URL, JWT_SECRET 등 입력
npm run build
npm run migration:run       # 스키마 + 기기 모델 목록 생성 (기존 데이터 유지)
npm run seed                # 시연 데이터 생성
npm run start:dev           # http://localhost:4000
```

<details>
<summary><b>환경변수 펼치기</b></summary>

| 이름 | 필수 | 설명 | 민감 |
|---|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL 연결 주소 (`postgresql://사용자:비밀번호@호스트/DB`) | 🔒 |
| `DATABASE_SCHEMA` | | 이 앱 전용 스키마 (기본 `testory`) | |
| `DATABASE_SSL` | | SSL 강제 `true`/`false` (비우면 localhost 외 자동 SSL) | |
| `JWT_SECRET` | ✅ | 토큰 서명 비밀값, 16자 이상 (`openssl rand -hex 32`) | 🔒 |
| `JWT_EXPIRES_IN` | | 토큰 유효 기간 (기본 `7d`) | |
| `FRONTEND_URL` | ✅ | 허용 프론트엔드 주소, 쉼표 구분 (끝 `/` 없이) | |
| `GPT_API_KEY` | AI 분석 시 | OpenAI API 키 (백엔드 전용) | 🔒 |
| `GPT_MODEL` | | 분석 모델 (기본 `gpt-4o-mini`) | |
| `GPT_SEARCH_MODEL` | | 참고자료 웹 검색 모델 (기본 `gpt-4.1-mini`) | |
| `PORT` | | 서버 포트 (기본 4000, Render 자동 주입) | |
| `NODE_ENV` | | 운영 `production` | |
| `DEMO_SEED_ENABLED` | 운영 시연 시 | `true` 일 때만 운영에서 시드·초기화 동작 | |
| `DEMO_PASSWORD` | 운영 시연 시 | 데모 계정 비밀번호 (운영은 직접 지정) | 🔒 |

</details>

**시연 데이터** — 관리자 1 · 테스터 20 · 모집글 10(삭제 1) · 피드백 36 · AI 분석 3

| 역할 | 이메일 | 비밀번호 |
|---|---|---|
| 관리자 | `admin@testory.demo` | `testory-demo-1234` |
| 일반 사용자 | `tester01` ~ `tester20@testory.demo` | `testory-demo-1234` |

- `npm run seed` · 관리자 "시연 데이터 초기화": 테스터·모집글·신청·피드백·AI 분석 재생성 (관리자·기기 모델 유지)
- 날짜 = 실행 시점 기준 계산 → 언제 실행해도 같은 진행 단계 구성

---

## 🧪 테스트 · 빌드

| 명령 | 내용 |
|---|---|
| `npm test` | 단위 테스트 (규칙 함수 등) |
| `npm run test:e2e` | API 통합 테스트 (테스트 전용 스키마 생성 후 삭제, `TEST_DATABASE_URL` 우선) |
| `npm run lint` | 타입 검사 |
| `npm run build` | `dist/` 생성 |

- 테스트 중 GPT 미호출 (가짜 클라이언트)

---

## ☁️ 배포 (Render)

| 항목 | 값 |
|---|---|
| 서비스 | Web Service (Blueprint: `render.yaml`) |
| Node | `NODE_VERSION=26` |
| **Build Command** | `npm ci --include=dev && npm run build` |
| **Start Command** | `npm run migration:run && npm run start:prod` |
| Health Check Path | `/health` |

| 환경변수 (Render) | 값 |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Render PostgreSQL **Internal** Database URL |
| `DATABASE_SCHEMA` | `testory` |
| `JWT_SECRET` | 랜덤 문자열 (Blueprint 자동 생성) |
| `FRONTEND_URL` | `https://testory-level01-frontend.vercel.app` |
| `GPT_API_KEY` | OpenAI API 키 |
| `DEMO_SEED_ENABLED` | `true` |
| `DEMO_PASSWORD` | `testory-demo-1234` |

1. Render PostgreSQL 생성 (웹 서비스와 같은 지역)
2. 저장소를 Web Service(또는 Blueprint)로 연결 → 환경변수 입력
3. 시작 시 마이그레이션 자동 실행 (데이터 삭제 없음)
4. 첫 시연 데이터: 로컬에서 External URL 로 `npm run seed`, 이후 관리자 화면에서 초기화
5. `FRONTEND_URL` = Vercel 주소와 정확히 일치 (불일치 시 변경 요청 403)

---

## 📁 폴더 구조

<details>
<summary><b>펼치기</b></summary>

```
src/
  main.ts, app.module.ts, app.setup.ts   # 부팅, 모듈 조립, 공통 설정
  config/                                # 환경변수 스키마 (zod)
  common/                                # 가드, 필터, 데코레이터, 열거형
  database/                              # data-source, migrations, seed
  modules/                               # auth, users, device-models, recruitments,
                                         # applications, feedbacks, ai-analyses,
                                         # dashboard, demo, health
test/                                    # API 통합 테스트
```

- 모듈 구조: controller(요청·응답) → service(규칙) → TypeORM

</details>
