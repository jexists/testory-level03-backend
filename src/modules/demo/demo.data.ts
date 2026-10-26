import { FeedbackType, Os, RecruitmentKind } from '../../common/enums';

/** 시연용 가상 데이터. 이름·이메일·IP 는 모두 가짜이고, IP 는 문서용 대역(203.0.113.x)만 쓴다. */

export const DEMO_ADMIN = { email: 'admin@testory.demo', nickname: '담당자 하루' };

export const DEMO_TESTERS: { nickname: string; os: Os; model: string }[] = [
  { nickname: '민준', os: Os.ANDROID, model: '갤럭시 S24' },
  { nickname: '서연', os: Os.IOS, model: '아이폰 15' },
  { nickname: '지호', os: Os.ANDROID, model: '갤럭시 S23' },
  { nickname: '하은', os: Os.IOS, model: '아이폰 15 Pro' },
  { nickname: '도윤', os: Os.ANDROID, model: '픽셀 8' },
  { nickname: '수아', os: Os.IOS, model: '아이폰 14' },
  { nickname: '예준', os: Os.ANDROID, model: '갤럭시 A54' },
  { nickname: '지우', os: Os.IOS, model: '아이폰 15' },
  { nickname: '시우', os: Os.ANDROID, model: '갤럭시 S24' },
  { nickname: '채원', os: Os.IOS, model: '아이폰 SE (3세대)' },
  { nickname: '주원', os: Os.ANDROID, model: '픽셀 7a' },
  { nickname: '유진', os: Os.IOS, model: '아이폰 15' },
  { nickname: '현우', os: Os.ANDROID, model: '갤럭시 S23' },
  { nickname: '서윤', os: Os.IOS, model: '아이폰 14' },
  { nickname: '건우', os: Os.ANDROID, model: '갤럭시 S24' },
  { nickname: '다은', os: Os.IOS, model: '아이폰 15 Pro' },
  { nickname: '준서', os: Os.ANDROID, model: '픽셀 8' },
  { nickname: '아린', os: Os.IOS, model: '아이폰 15' },
  { nickname: '태윤', os: Os.IOS, model: '아이폰 14' },
  { nickname: '소율', os: Os.ANDROID, model: '갤럭시 A54' },
];

export const testerEmail = (index: number) => `tester${String(index + 1).padStart(2, '0')}@testory.demo`;

export interface DemoRecruitment {
  title: string;
  description: string;
  kind: RecruitmentKind;
  capacity: number;
  /** 시작일(모집 마감일): 오늘 기준 며칠 뒤 (음수는 이미 시작) */
  startInDays: number;
  endInDays: number;
  /** 정원이 차서 테스트가 일찍 시작된 날: 오늘 기준 며칠 전 */
  filledDaysAgo?: number;
  isClosed?: boolean;
  devices: { os: Os; scope: 'ALL' | 'MODEL'; model?: string }[];
  /** 신청자: 테스터 번호(0부터). 순서대로 신청한 것으로 만든다. */
  applicants: number[];
  /** 취소 기록만 남은 테스터 */
  cancelled?: number[];
  ip: string;
}

export const DEMO_RECRUITMENTS: DemoRecruitment[] = [
  {
    title: '하루칸 앱 전체 베타 테스트',
    description:
      '하루칸 1.0 출시 전, 앱 전체를 일주일 이상 직접 써 보실 테스터를 모십니다. 일정 등록부터 알림, 공유까지 평소처럼 써 보시고 불편했던 점을 알려 주세요.',
    kind: RecruitmentKind.APP_FULL,
    capacity: 15,
    startInDays: 4,
    endInDays: 18,
    filledDaysAgo: 3,
    devices: [
      { os: Os.ANDROID, scope: 'ALL' },
      { os: Os.IOS, scope: 'ALL' },
    ],
    applicants: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    cancelled: [15],
    ip: '203.0.113.11',
  },
  {
    title: '알림 기능 테스트',
    description:
      '일정 알림(시간 지정, 반복 알림, 방해 금지 시간)을 써 보고 알림이 제때 오는지, 설정이 이해되는지 알려 주세요.',
    kind: RecruitmentKind.FEATURE,
    capacity: 20,
    startInDays: -16,
    endInDays: -6,
    devices: [
      { os: Os.ANDROID, scope: 'ALL' },
      { os: Os.IOS, scope: 'ALL' },
    ],
    applicants: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    cancelled: [16],
    ip: '203.0.113.12',
  },
  {
    title: '일정 공유 기능 테스트',
    description: '친구·가족과 일정을 공유하는 기능을 써 볼 테스터를 모집합니다. 초대 링크로 함께 쓸 분이 있으면 더 좋아요.',
    kind: RecruitmentKind.FEATURE,
    capacity: 10,
    startInDays: 5,
    endInDays: 19,
    devices: [
      { os: Os.ANDROID, scope: 'ALL' },
      { os: Os.IOS, scope: 'MODEL', model: '아이폰 15' },
    ],
    applicants: [0, 2, 4, 6, 8, 1, 7, 11],
    ip: '203.0.113.13',
  },
  {
    title: '반복 일정 기능 테스트',
    description: '매주·매월 반복되는 일정을 만들고 수정해 보는 테스트입니다. 시작일이 멀어서 신청 취소도 해 볼 수 있어요.',
    kind: RecruitmentKind.FEATURE,
    capacity: 15,
    startInDays: 30,
    endInDays: 44,
    devices: [{ os: Os.ANDROID, scope: 'ALL' }],
    applicants: [0, 2, 4, 6],
    ip: '203.0.113.14',
  },
  {
    title: '캘린더 화면 개선 테스트',
    description: '새로 바뀐 월간·주간 캘린더 화면을 써 보는 iOS 전용 테스트입니다. 관리자가 모집을 먼저 마감했어요.',
    kind: RecruitmentKind.FEATURE,
    capacity: 15,
    startInDays: -12,
    endInDays: -4,
    devices: [{ os: Os.IOS, scope: 'ALL' }],
    applicants: [1, 3, 5, 7, 9],
    ip: '203.0.113.15',
  },
];

/** recruitmentIndex: DEMO_RECRUITMENTS 의 순서, tester: 테스터 번호 (해당 모집글 신청자만 쓸 수 있다) */
export interface DemoFeedback {
  recruitmentIndex: number;
  tester: number;
  type: FeedbackType;
  title: string;
  content: string;
  /** 며칠 전에 썼는지 */
  daysAgo: number;
}

const B = FeedbackType.BUG;
const I = FeedbackType.IMPROVEMENT;
const P = FeedbackType.PRAISE;

export const DEMO_FEEDBACKS: DemoFeedback[] = [
  // 0: 앱 전체 (7건)
  { recruitmentIndex: 0, tester: 0, type: P, title: '첫 화면이 깔끔해요', content: '오늘 일정이 한눈에 보여서 앱을 열자마자 뭘 해야 하는지 알 수 있어요.', daysAgo: 2 },
  { recruitmentIndex: 0, tester: 1, type: B, title: '일정을 저장하면 가끔 앱이 멈춰요', content: '제목을 길게 쓰고 저장하면 로딩이 계속 돌다가 앱을 다시 켜야 했어요. 두 번 재현됐습니다.', daysAgo: 2 },
  { recruitmentIndex: 0, tester: 2, type: I, title: '다크 모드가 있으면 좋겠어요', content: '밤에 쓰면 화면이 너무 밝아서 눈이 아파요. 다크 모드를 지원해 주세요.', daysAgo: 1 },
  { recruitmentIndex: 0, tester: 3, type: P, title: '일정 색상 구분이 편해요', content: '카테고리별로 색이 달라서 일과 개인 일정을 구분하기 쉬워요.', daysAgo: 1 },
  { recruitmentIndex: 0, tester: 4, type: B, title: '위젯이 자정 이후에 갱신되지 않아요', content: '날짜가 바뀌어도 위젯에 어제 일정이 남아 있어요. 앱을 열어야 갱신됩니다.', daysAgo: 1 },
  { recruitmentIndex: 0, tester: 5, type: I, title: '일정 검색 기능이 필요해요', content: '지난 일정을 찾으려면 달력을 계속 넘겨야 해서 불편해요. 검색창이 있으면 좋겠어요.', daysAgo: 0 },
  { recruitmentIndex: 0, tester: 6, type: I, title: '온보딩 설명을 건너뛸 수 있게 해 주세요', content: '처음 실행할 때 설명이 다섯 장이나 나와서 지루했어요. 건너뛰기 버튼이 있으면 좋겠어요.', daysAgo: 0 },
  // 1: 알림 기능 (18건, AI 분석 시연용)
  { recruitmentIndex: 1, tester: 0, type: B, title: '알림이 설정한 시간보다 늦게 와요', content: '오전 9시로 맞췄는데 9시 10분쯤 알림이 왔어요. 절전 모드일 때 특히 늦습니다.', daysAgo: 2 },
  { recruitmentIndex: 1, tester: 2, type: B, title: '반복 알림이 두 번씩 울려요', content: '매일 반복 알림을 만들었더니 같은 시간에 알림이 두 번 왔어요.', daysAgo: 2 },
  { recruitmentIndex: 1, tester: 4, type: B, title: '방해 금지 시간에도 알림이 와요', content: '밤 11시부터 아침 7시까지 방해 금지로 설정했는데 새벽에 알림이 울렸어요.', daysAgo: 2 },
  { recruitmentIndex: 1, tester: 1, type: B, title: '알림을 눌러도 해당 일정으로 이동하지 않아요', content: '알림을 누르면 홈 화면만 열려요. 해당 일정 상세로 바로 가면 좋겠어요.', daysAgo: 1 },
  { recruitmentIndex: 1, tester: 3, type: B, title: '알림 소리를 바꿔도 적용이 안 돼요', content: '설정에서 알림음을 바꿨는데 계속 기본 소리가 나요.', daysAgo: 1 },
  { recruitmentIndex: 1, tester: 5, type: I, title: '알림 시간을 한 번에 여러 개 설정하고 싶어요', content: '하루 전, 한 시간 전, 10분 전 이렇게 세 번 받고 싶은데 하나씩 만들어야 해서 번거로워요.', daysAgo: 1 },
  { recruitmentIndex: 1, tester: 6, type: I, title: '알림 미리 보기에 장소도 보여 주세요', content: '알림에 제목만 나와서 장소를 알려면 앱을 열어야 해요.', daysAgo: 1 },
  { recruitmentIndex: 1, tester: 7, type: I, title: '알림 끄기 스위치를 설정 맨 위로', content: '알림을 잠깐 끄고 싶은데 설정 안쪽에 있어서 찾기 어려웠어요.', daysAgo: 1 },
  { recruitmentIndex: 1, tester: 8, type: I, title: '반복 알림 종료일을 정하고 싶어요', content: '반복 알림이 끝나는 날짜를 정할 수 없어서 계속 울려요.', daysAgo: 0 },
  { recruitmentIndex: 1, tester: 9, type: I, title: '알림 설정 화면 문구가 어려워요', content: '"스누즈 간격" 같은 용어가 무슨 뜻인지 모르겠어요. 쉬운 말로 바꿔 주세요.', daysAgo: 0 },
  { recruitmentIndex: 1, tester: 10, type: P, title: '알림 문구가 친절해서 좋아요', content: '"곧 시작해요" 같은 문구가 부담스럽지 않고 좋았어요.', daysAgo: 2 },
  { recruitmentIndex: 1, tester: 11, type: P, title: '알림 설정이 직관적이에요', content: '시간 고르는 화면이 큼직해서 한 손으로 쓰기 편했어요.', daysAgo: 1 },
  { recruitmentIndex: 1, tester: 1, type: P, title: '다시 알림(미루기) 기능이 유용해요', content: '10분 뒤에 다시 알려 주는 버튼이 출근 준비할 때 정말 도움이 됐어요.', daysAgo: 1 },
  { recruitmentIndex: 1, tester: 3, type: B, title: '알림 권한을 끄면 안내 없이 아무것도 안 와요', content: '실수로 알림 권한을 껐더니 이유를 알려 주지 않아서 한참 헤맸어요.', daysAgo: 0 },
  { recruitmentIndex: 1, tester: 5, type: B, title: '시간대를 바꾸면 알림 시간이 어긋나요', content: '해외 출장 중에 시간대가 바뀌니까 알림 시간이 한 시간 밀려서 왔어요.', daysAgo: 0 },
  { recruitmentIndex: 1, tester: 7, type: I, title: '조용한 알림(진동만) 옵션이 필요해요', content: '회의 중에는 소리 없이 진동만 오는 옵션이 있었으면 해요.', daysAgo: 0 },
  { recruitmentIndex: 1, tester: 9, type: P, title: '알림 위젯 연동이 좋아요', content: '다음 알림 시간이 위젯에 보여서 확인하기 편해요.', daysAgo: 0 },
  { recruitmentIndex: 1, tester: 11, type: B, title: '알림 목록이 가끔 비어 보여요', content: '알림 내역 화면에 들어가면 가끔 아무것도 없다가 새로 고침하면 나타나요.', daysAgo: 0 },
  // 4: 캘린더 화면 개선 (5건)
  { recruitmentIndex: 4, tester: 1, type: P, title: '주간 화면이 보기 편해요', content: '한 주 일정을 시간대별로 볼 수 있어서 계획 세우기 좋아요.', daysAgo: 1 },
  { recruitmentIndex: 4, tester: 3, type: B, title: '월간 화면에서 일정이 겹쳐 보여요', content: '하루에 일정이 네 개 넘으면 글자가 겹쳐서 읽을 수 없어요.', daysAgo: 1 },
  { recruitmentIndex: 4, tester: 5, type: I, title: '오늘로 돌아가는 버튼이 필요해요', content: '몇 달 뒤로 넘기면 오늘로 돌아오기가 어려워요.', daysAgo: 1 },
  { recruitmentIndex: 4, tester: 7, type: I, title: '주 시작 요일을 고를 수 있으면 좋겠어요', content: '월요일부터 시작하는 달력이 더 익숙해요.', daysAgo: 0 },
  { recruitmentIndex: 4, tester: 9, type: P, title: '화면 전환 애니메이션이 부드러워요', content: '월간과 주간을 오갈 때 끊기지 않고 자연스러워요.', daysAgo: 0 },
];

export const DEMO_ANALYSES = [
  {
    versionNo: 1,
    daysAgo: 2,
    feedbackCount: 10,
    result: {
      recurringIssues: ['알림이 설정한 시간보다 늦게 도착한다는 의견이 있었어요 (절전 모드에서 특히).', '반복 알림이 두 번씩 울린다는 보고가 있어요.'],
      improvementRequests: ['한 번에 여러 개의 알림 시간을 설정하고 싶어요.', '알림 설정 화면의 용어를 더 쉽게 바꿔 달라는 요청이 있어요.'],
      positiveOpinions: ['알림 문구가 친절하고 부담스럽지 않다는 평가가 있어요.'],
      priorityChecks: ['절전 모드에서 알림이 늦게 오는 원인 확인', '반복 알림 중복 발송 여부 확인'],
    },
  },
  {
    versionNo: 2,
    daysAgo: 1,
    feedbackCount: 14,
    result: {
      recurringIssues: [
        '알림 지연(절전 모드, 시간대 변경)이 여러 피드백에서 반복돼요.',
        '반복 알림 중복 발송과 방해 금지 시간 무시 문제가 보고됐어요.',
        '알림을 눌러도 해당 일정으로 이동하지 않는다는 의견이 있어요.',
      ],
      improvementRequests: [
        '알림 시간을 한 번에 여러 개 설정하는 기능',
        '알림 미리 보기에 장소 표시',
        '알림 끄기 스위치를 설정 맨 위로 이동',
        '설정 화면 용어를 쉬운 말로 변경',
      ],
      positiveOpinions: ['알림 문구가 친절해요.', '다시 알림(미루기) 기능이 출근 준비에 도움이 돼요.', '시간 고르는 화면이 한 손으로 쓰기 편해요.'],
      priorityChecks: ['방해 금지 시간에도 알림이 오는 문제 (사용자 불편이 큼)', '알림 지연 원인 확인 (절전 모드, 시간대)', '알림 탭 시 일정 상세로 이동하도록 수정'],
    },
  },
];
