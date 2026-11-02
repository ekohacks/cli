export interface RepoFile {
  path: string;
  content: string;
}

export interface GateReport {
  checks: { name: string; passed: boolean; reason?: string }[];
}

export const gateCheck = ({ files, paths }: { files: RepoFile[]; paths: string[] }): GateReport => {
  void files;
  void paths;
  return { checks: [] };
};
