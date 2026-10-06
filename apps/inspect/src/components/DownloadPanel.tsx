import { FC } from "react";

import { DownloadButton } from "../components/DownloadButton";
import type { ExportContext } from "../exports";

import styles from "./DownloadPanel.module.css";

interface DownloadPanelProps {
  message: string;
  buttonLabel: string;
  fileName: string;
  fileContents: string | Blob | ArrayBuffer | ArrayBufferView<ArrayBuffer>;
  exportContext?: ExportContext;
}

export const DownloadPanel: FC<DownloadPanelProps> = ({
  message,
  buttonLabel,
  fileName,
  fileContents,
  exportContext,
}) => {
  return (
    <div>
      <div className={styles.downloadPanel}>
        <div className={styles.downloadPanelMessage}>{message}</div>
        <DownloadButton
          label={buttonLabel}
          fileName={fileName}
          fileContents={fileContents}
          exportContext={exportContext}
        />
      </div>
    </div>
  );
};
