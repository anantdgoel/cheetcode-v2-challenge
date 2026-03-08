import type { ArtifactName } from "@/lib/contracts/game";

export type ActiveTab = ArtifactName | "editor";
export type SavingState = "idle" | "saving" | "saved";
export type StepState = "completed" | "active" | "upcoming" | "disabled";

export type ActionStep = {
  state: StepState;
  number: string;
  label: string;
  loading: boolean;
  loadingLabel: string;
  action: () => void;
};

export type ReadoutField = {
  label: string;
  value: string;
  modifier: string;
};
