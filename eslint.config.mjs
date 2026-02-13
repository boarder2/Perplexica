import nextConfig from 'eslint-config-next/core-web-vitals';
import nextTypeScriptConfig from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier';

const config = [
  {
    ignores: [
      '**/.next/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/drizzle/**',
      '**/storage/**',
      '**/uploads/**',
      '**/data/**',
      '.prettierrc.js',
      'postcss.config.js',
      'tailwind.config.ts',
    ],
  },
  ...nextConfig,
  ...nextTypeScriptConfig,
  prettierConfig,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
];

export default config;
