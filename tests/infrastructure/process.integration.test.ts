import { describe } from 'vitest';
import { ProcessRunner } from '../../src/infrastructure/process.ts';
import { processRunnerContract } from './processContract.ts';

// The real side: every command in the contract runs through a real shell. The configured
// answers are what the null is handed; here they are ignored and the shell answers.
describe('ProcessRunner (integration)', () => {
  processRunnerContract(() => ProcessRunner.create());
});
