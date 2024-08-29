export interface ScrollBoxOffset {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScrollNotifyCallbackArgs {
  x: number;
  y: number;
  width: number;
  height: number;
  forceNotifyEnter?: boolean;
}

export type VoidFunction = () => void;
