// Finds the changelog entry for a version: the lines between its `## X.Y.Z` heading and
// the next `## ` heading, without the heading itself. The heading is dropped because the
// entry's consumers already carry the version: a GitHub Release titles itself vX.Y.Z, so
// its notes start straight at the entry body.
export const changelogEntryFor = (log: string, version: string): string | undefined => {
  const lines = log.split('\n');
  const heading = lines.indexOf(`## ${version}`);
  if (heading === -1) {
    return undefined;
  }
  const body = lines.slice(heading + 1);
  const nextHeading = body.findIndex((line) => line.startsWith('## '));
  const entry = nextHeading === -1 ? body : body.slice(0, nextHeading);
  return entry.join('\n').trim();
};
