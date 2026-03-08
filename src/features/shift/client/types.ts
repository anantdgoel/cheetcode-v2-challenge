import type { ArtifactName } from '@/core/domain/game'

export type ActiveTab = ArtifactName | 'editor';
export type SavingState = 'idle' | 'saving' | 'saved';
export type StepState = 'completed' | 'active' | 'upcoming' | 'disabled';
export type ClockTone = 'steady' | 'tight' | 'critical' | 'resolved';

export type ActionStep = {
  action: () => void;
  emphasized?: boolean;
  label: string;
  loading: boolean;
  loadingLabel: string;
  number: string;
  state: StepState;
};

export type ReadoutField = {
  label: string;
  modifier?: string;
  value: string;
};
