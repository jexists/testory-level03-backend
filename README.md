# Testory Backend

베타테스터 모집·신청·피드백을 관리하고 GPT로 피드백을 종합 분석하는 **테스토리(Testory)** 의 API 서버입니다.
NestJS · TypeORM · PostgreSQL · JWT 로 만들었고, 규칙(정원·기기 조건·권한 등)은 모두 서버가 마지막에 한 번 더 검사합니다.

- 프론트엔드 저장소: `testory-level01-frontend`
- 기획서: [기획서.md](./기획서.md)

> **첫 접속이 느릴 수 있어요.**
> 이 서버는 Render 무료 플랜에 올라가 있어서, 한동안 접속이 없으면 잠들어 있다가 첫 요청에 깨어납니다.
> 첫 화면이나 로그인이 **30초~1분쯤** 걸릴 수 있으니 기다리면 정상적으로 열립니다. 한 번 깨어나면 이후에는 빠릅니다.
> 깨어났는지는 `/health` 주소로 확인할 수 있어요. `{"status":"ok","db":"connected"}` 가 보이면 준비된 것입니다.

## 주요 기능
- 모집글 등록·수정·삭제(Soft Delete)·마감, 기기 조건(Android 전체 / iOS 전체 / 특정 모델)
- 신청·취소·재신청, 정원 자동 마감, 신청 당시 기기 정보 보존
- 피드백 작성(유형 직접 선택), 사용자별·모집글별 피드백 수 조회
- 모집글별 AI 분석(GPT), 결과를 버전별로 저장하고 이전 버전 조회
- 관리자 현황(숫자 3개), 시연 데이터 초기화, `GET /health`

## 폴더 구조
```
src/
├─ main.ts / app.module.ts
├─ core/        앱 전체의 기반: config, database, auth(JWT·가드·역할), filters, pipes, decorators
├─ shared/      여러 기능이 함께 쓰는 코드: constants, types, utils
└─ modules/     기능별 모듈(module · controller · service · dto · entities)
   users · auth · health · recruitments · applications · feedbacks · ai-analysis · dashboard · demo
```

## 환경변수
저장소에는 값을 올리지 않습니다. `.env.example` 을 복사해 `.env` 로 만들어 쓰세요.

| 이름 | 필수 | 뜻 |
|---|---|---|
| `DATABASE_URL` | 예 | PostgreSQL 연결 주소. 예: `postgresql://사용자:비밀번호@호스트/DB이름` |
| `JWT_SECRET` | 예 | 로그인 토큰을 서명하는 비밀 문자열. 길고 무작위로 만드세요. |
| `FRONTEND_ORIGIN` | 예 | 접속을 허용할 프론트엔드 주소(Vercel 주소). 여러 개면 쉼표로 구분. 끝에 `/` 를 붙이지 마세요. |
| `GPT_API_KEY` | 아니오 | GPT API 키. AI 분석 버튼에만 쓰이며 비어 있으면 분석만 실패 안내가 나옵니다. |
| `GPT_MODEL` | 아니오 | 분석에 쓰는 GPT 모델 이름. 기본값 `gpt-4o-mini`. |
| `PORT` | 아니오 | 서버 포트. 기본 4000. Render 가 자동으로 넣어 줍니다. |

## 로컬 실행
```bash
npm install
cp .env.example .env     # DATABASE_URL, JWT_SECRET 을 채웁니다
npm run start:dev        # http://localhost:4000
```
DB 가 비어 있으면 처음 기동할 때 시연 데이터를 자동으로 채웁니다. 이후에는 관리자 화면의 "시연 데이터 초기화"로 다시 채울 수 있습니다.
테이블은 서버가 시작할 때 엔티티에 맞춰 만들어집니다(시연용 구성).

## Render 배포
저장소에 `render.yaml`(Blueprint)이 들어 있어, Render 에서 **New → Blueprint** 로 이 저장소를 연결하면 아래 값이 미리 채워집니다. 수동으로 만든다면 **New → Web Service** 에서 아래처럼 넣으세요.

| 설정 | 값 |
|---|---|
| Runtime | Node |
| Region | Singapore (DB 와 같은 지역) |
| Instance Type | Free |
| **Build Command** | `npm install --include=dev && npm run build` |
| **Start Command** | `npm run start:prod` |
| Health Check Path | `/health` |
| Environment | 위 환경변수 표의 `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`, `GPT_API_KEY`, `GPT_MODEL` + `NODE_VERSION=22` |

배포 순서:
1. Render 에서 서비스를 만들고 환경변수를 넣습니다. `FRONTEND_ORIGIN` 은 일단 비워 두거나 임시 값을 넣어도 됩니다.
2. 배포가 끝나면 `https://<서비스이름>.onrender.com/health` 에서 DB 연결을 확인합니다.
3. 프론트엔드를 Vercel 에 올린 뒤, 그 주소를 `FRONTEND_ORIGIN` 에 넣고 다시 배포합니다.

## 시연 계정 (모두 가상)
| 역할 | 이메일 | 비밀번호 |
|---|---|---|
| 관리자 | `admin@testory.demo` | `admin1234` |
| 테스터 20명 | `tester01@example.com` ~ `tester20@example.com` | `testory1234` |
