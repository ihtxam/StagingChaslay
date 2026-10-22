import { createContext, useContext } from 'react';

export type OnScreenKeyboardContextValue = {
  open: boolean;
  openKeyboard: () => void;
  toggle: () => void;
  close: () => void;
};

export const OnScreenKeyboardContext = createContext<OnScreenKeyboardContextValue | null>(null);

const noopKeyboard: OnScreenKeyboardContextValue = {
  open: false,
  openKeyboard: () => {},
  toggle: () => {},
  close: () => {},
};

export function useOnScreenKeyboard(): OnScreenKeyboardContextValue {
  const ctx = useContext(OnScreenKeyboardContext);
  return ctx ?? noopKeyboard;
}
