import { describe } from 'vitest';
import { GitWrapper } from '../../src/infrastructure/git.ts';
import { gitContract } from './gitContract.ts';

describe('GitWrapper (nulled)', () => {
  gitContract((state) => Promise.resolve(GitWrapper.createNull(state)));
});
