export type ProofreadTargetTone = 'auto' | 'honorific' | 'plain' | 'polite';

export interface ProofreadDiffItem {
  id: string;
  original: string;
  replacement: string;
  category: 'spelling' | 'grammar' | 'expression' | 'bold_format' | 'consistency' | 'citation' | 'timestamp' | 'tone';
  explanation: string;
  line?: number;
  approved?: boolean;
}

export interface ProofreadOptions {
  checkSpelling: boolean;
  checkGrammar: boolean;
  checkTone?: boolean;
  targetTone?: ProofreadTargetTone;
  removeTimestamps?: boolean;
  improveExpression: boolean;
  checkConsistency: boolean;
  searchCitation: boolean;
  vaultSourcePath?: string;
}

export interface ConsistencyIssue {
  originalText: string;
  sourceText: string;
  sourceFile: string;
  discrepancyType: 'contradiction' | 'number_mismatch' | 'terminology';
  explanation: string;
  suggestedReplacement?: string;
}
