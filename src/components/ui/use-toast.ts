"use client";

import * as React from "react";
import type { ToastProps } from "./toast";

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
};

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 5000;

type State = { toasts: ToasterToast[] };

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(action: { type: "ADD"; toast: ToasterToast } | { type: "REMOVE"; id: string }) {
  if (action.type === "ADD") {
    memoryState = {
      toasts: [action.toast, ...memoryState.toasts].slice(0, TOAST_LIMIT),
    };
  } else if (action.type === "REMOVE") {
    memoryState = {
      toasts: memoryState.toasts.filter((t) => t.id !== action.id),
    };
  }
  listeners.forEach((l) => l(memoryState));
}

export function toast(props: { title?: string; description?: string; variant?: "default" | "destructive" }) {
  const id = Math.random().toString(36).slice(2);
  dispatch({ type: "ADD", toast: { id, ...props, open: true } });
  setTimeout(() => dispatch({ type: "REMOVE", id }), TOAST_REMOVE_DELAY);
  return { id };
}

export function dismissToast(id: string) {
  dispatch({ type: "REMOVE", id });
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const i = listeners.indexOf(setState);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);
  return { ...state, toast };
}
