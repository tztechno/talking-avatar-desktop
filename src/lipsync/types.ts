/** X = closed / rest */
export type Viseme = "X" | "A" | "I" | "U" | "E" | "O";

export const VISEMES: readonly Viseme[] = ["X", "A", "I", "U", "E", "O"];

export interface MouthState {
  viseme: Viseme;
  /** 0 = closed, 1 = fully open */
  open: number;
}

export interface LipSync {
  frame(t: number): MouthState;
}

export const REST: MouthState = { viseme: "X", open: 0 };
