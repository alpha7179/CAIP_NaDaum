// 테스트 셋업 (jest-dom matchers 확장)
import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

expect.extend(matchers);
