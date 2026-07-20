import { describe, expect, it } from 'vitest';
import { changelogEntryFor } from '../../src/logic/changelog.ts';

const CHANGELOG = [
  '# Changelog',
  '',
  'All notable changes to `ekolite` are recorded here.',
  '',
  '## 0.5.0',
  '',
  '### Added',
  '',
  '- **A thing.** What it does for a consumer. (#160)',
  '',
  '## 0.4.0',
  '',
  '### Fixed',
  '',
  '- **An older thing.** (#152)',
  '',
].join('\n');

describe('changelogEntryFor', () => {
  it('returns the body of the entry for a version, without its heading', () => {
    const entry = changelogEntryFor(CHANGELOG, '0.5.0');

    expect(entry).toBe(
      ['### Added', '', '- **A thing.** What it does for a consumer. (#160)'].join('\n'),
    );
  });

  it('returns undefined for a version with no entry', () => {
    expect(changelogEntryFor(CHANGELOG, '9.9.9')).toBeUndefined();
  });
});
