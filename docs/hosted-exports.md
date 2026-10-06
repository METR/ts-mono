# Hosted export policy

An embedding host can install `setExportHandler(handler)` before enabling export
controls. The handler receives `{kind, logFile}` and an asynchronous `action`.
Call `action()` to prepare and save the export, or reject without calling it to
deny the action. Preparation (including fetching message chunks and serializing
samples) is inside the wrapper. Without a handler, standalone behavior is
unchanged. `setExportHandler()` removes the handler.

Kinds are `eval_file`, `eval_json`, `sample_json`, `sample_messages`, and
`sample_transcript`. `logFile` identifies the originating viewer log, not the
output filename. A host that uses synthetic multi-log paths must map them to real
resources before asking its server to authorize the export.

Hosts can call `updateCapabilities({downloadFiles, downloadLogs})` after
`initializeStore` to change controls without resetting selections or loaded
content. Hidden controls are a convenience, not an authorization boundary: the
host should check policy when handling an export, and its server must enforce
dedicated download routes independently. A resolved action means browser handoff,
not a completed transfer or saved file.

The only new visual state is the oversized eval-JSON fallback when file downloads
are unavailable. These screenshots use synthetic data and the actual component.

| Theme | Exports enabled | Exports disabled |
| --- | --- | --- |
| Light | ![Enabled](images/eval-downloads/light-enabled.png) | ![Disabled](images/eval-downloads/light-disabled.png) |
| Dark | ![Enabled](images/eval-downloads/dark-enabled.png) | ![Disabled](images/eval-downloads/dark-disabled.png) |
