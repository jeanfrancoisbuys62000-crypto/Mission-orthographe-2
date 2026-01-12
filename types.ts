
export enum ModuleType {
  TRAINING = 'TRAINING',
  BREVET = 'BREVET'
}

export type DifficultyLevel = 1 | 2 | 3 | 4;

export interface DictationMetadata {
  id: string;
  author: string;
  source: string;
  date: string;
  index: number;
}

export interface DictationText extends DictationMetadata {
  content: string;
  wordCount: number;
  level: DifficultyLevel;
  type: ModuleType;
}

export interface ErrorDetail {
  text: string;
  type: 'grammar' | 'lexical';
  hint: string;
  startIndex: number;
  endIndex: number;
}

export interface EvaluationResult {
  score: number;
  comment: string;
  errors: ErrorDetail[];
  correctText: string;
}

export interface UserProgress {
  completedTraining: string[]; // Format: "level-1-text-5"
  completedBrevet: string[];   // Format: "brevet-text-12"
  catalogs: {
    [key: string]: DictationMetadata[]; // "level-1", "brevet", etc.
  };
}
