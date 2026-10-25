import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Nest 의 의존성 주입은 데코레이터 메타데이터가 필요해서 swc 로 변환한다.
 * Nest 12 코어는 ESM 전용이라 Jest(CommonJS) 대신 Vitest 를 쓴다.
 */
const plugins = [
  swc.vite({
    jsc: {
      target: 'es2022',
      parser: { syntax: 'typescript', decorators: true },
      transform: { legacyDecorator: true, decoratorMetadata: true },
    },
  }),
];

export default defineConfig({
  plugins,
  test: {
    projects: [
      { plugins, test: { name: 'unit', include: ['src/**/*.spec.ts'], environment: 'node' } },
      {
        plugins,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          environment: 'node',
          testTimeout: 60_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
