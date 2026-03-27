// ---- Virtual Filesystem ----
export interface VirtualFile {
  path: string;
  content: string;
}

export type FileSystem = Map<string, VirtualFile>; // path -> VirtualFile

// ---- Git Objects ----
export type ObjectHash = string; // 7-char short hash

export interface CommitObject {
  type: 'commit';
  hash: ObjectHash;
  parentHashes: ObjectHash[];
  message: string;
  author: string;
  timestamp: number;
  snapshot: Map<string, VirtualFile>; // full file snapshot at this commit
}

// ---- Refs ----
export interface BranchRef {
  name: string;
  commitHash: ObjectHash;
}

export type HEAD =
  | { type: 'branch'; name: string }
  | { type: 'detached'; commitHash: ObjectHash };

// ---- Staging Area ----
export type StagingArea = Map<string, VirtualFile>;

// ---- Stash ----
export interface StashEntry {
  id: number;
  message: string;
  workingDirectory: Map<string, VirtualFile>;
  stagingArea: Map<string, VirtualFile>;
  baseBranch: string;
  baseCommitHash: ObjectHash;
}

// ---- Merge Conflict ----
export interface ConflictMarker {
  filePath: string;
  oursContent: string;
  theirsContent: string;
}

// ---- Remote ----
export interface RemoteRepo {
  name: string;
  url: string;
  branches: Map<string, ObjectHash>;
  commits: Map<ObjectHash, CommitObject>;
}

// ---- Reflog Entry ----
export interface ReflogEntry {
  hash: ObjectHash;
  previousHash: ObjectHash | null;
  action: string;
  message: string;
  timestamp: number;
}

// ---- Complete Repository State ----
export interface RepoState {
  initialized: boolean;
  workingDirectory: FileSystem;
  stagingArea: StagingArea;
  HEAD: HEAD;
  branches: Map<string, BranchRef>;
  commits: Map<ObjectHash, CommitObject>;
  remotes: Map<string, RemoteRepo>;
  stash: StashEntry[];
  reflog: ReflogEntry[];
  conflicts: ConflictMarker[];
  config: {
    userName: string;
    userEmail: string;
  };
  gitignorePatterns: string[];
  // Track which files were removed via git rm
  removedFiles: Set<string>;
}

// ---- Zones for visualization ----
export type Zone = 'working' | 'staging' | 'local' | 'remote';

// ---- State Transition (drives animations) ----
export interface StateTransition {
  type: 'add' | 'commit' | 'push' | 'pull' | 'fetch' | 'checkout'
    | 'merge' | 'reset' | 'stash' | 'stash-pop' | 'init' | 'clone'
    | 'rm' | 'revert';
  from: Zone;
  to: Zone;
  files: string[];
}

// ---- Command Result ----
export interface CommandResult {
  success: boolean;
  output: string;
  state: RepoState;
  transitions: StateTransition[];
}
