import { clsx } from "clsx";
import { FC } from "react";

import { getApi } from "../app_config";
import { runExport, type ExportContext } from "../exports";

import styles from "./DownloadButton.module.css";

interface DownloadButtonProps {
  label: string;
  fileName: string;
  fileContents: string | Blob | ArrayBuffer | ArrayBufferView<ArrayBuffer>;
  exportContext?: ExportContext;
}

export const DownloadButton: FC<DownloadButtonProps> = ({
  label,
  fileName,
  fileContents,
  exportContext,
}) => {
  const api = getApi();
  return (
    <button
      type="button"
      className={clsx("btn", "btn-outline-primary", styles.downloadButton)}
      onClick={() => {
        const action = () => api.download_file(fileName, fileContents);
        const result = exportContext
          ? runExport(exportContext, action)
          : action();
        result.catch((error: unknown) => {
          console.error("Failed to download file:", error);
        });
      }}
    >
      {label}
    </button>
  );
};
