"use client";
import { useRef, useState, type InputHTMLAttributes } from "react";
import { useI18n } from "../lib/i18n";
import { Button } from "./ui";
export function FileInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState("");
  return (
    <span className="file-control">
      <input
        {...props}
        ref={ref}
        type="file"
        className="file-control-input"
        onChange={(e) => {
          setFilename(e.target.files?.[0]?.name || "");
          props.onChange?.(e);
        }}
      />
      <Button
        type="button"
        disabled={props.disabled}
        onClick={(e) => {
          e.preventDefault();
          ref.current?.click();
        }}
      >
        {t("Choose file")}
      </Button>
      <span aria-live="polite">{filename || t("No file selected")}</span>
    </span>
  );
}
