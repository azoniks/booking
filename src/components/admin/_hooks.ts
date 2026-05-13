"use client";

import { useState, useCallback, useRef } from "react";

function serialize(form: HTMLFormElement) {
  const fd = new FormData(form);
  const parts: string[] = [];
  for (const [k, v] of fd.entries()) {
    parts.push(`${k}=${typeof v === "string" ? v : "[file]"}`);
  }
  return parts.sort().join("&");
}

export function useFormDirty() {
  const [dirty, setDirty] = useState(false);
  const initial = useRef<string>("");
  const formEl = useRef<HTMLFormElement | null>(null);

  const setRef = useCallback((node: HTMLFormElement | null) => {
    formEl.current = node;
    if (node) {
      initial.current = serialize(node);
    }
  }, []);

  const recompute = useCallback(() => {
    if (!formEl.current) return;
    setDirty(serialize(formEl.current) !== initial.current);
  }, []);

  const reset = useCallback(() => {
    if (formEl.current) initial.current = serialize(formEl.current);
    setDirty(false);
  }, []);

  const formProps = {
    ref: setRef,
    onChange: recompute,
    onInput: recompute,
  };

  return { dirty, formProps, reset };
}
