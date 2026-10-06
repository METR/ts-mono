export type ExportKind =
  | "eval_file"
  | "eval_json"
  | "sample_json"
  | "sample_messages"
  | "sample_transcript";

export interface ExportContext {
  kind: ExportKind;
  logFile: string;
}

export type ExportHandler = (
  context: ExportContext,
  action: () => Promise<void>
) => Promise<void>;

let exportHandler: ExportHandler | undefined;

/** Install host policy/telemetry around the entire export, including preparation. */
export const setExportHandler = (handler?: ExportHandler): void => {
  exportHandler = handler;
};

export const runExport: ExportHandler = async (context, action) => {
  if (exportHandler) {
    await exportHandler(context, action);
  } else {
    await action();
  }
};
