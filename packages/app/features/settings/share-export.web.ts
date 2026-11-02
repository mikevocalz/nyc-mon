/**
 * Web: the browser's share sheet with the file where it can share files
 * (mobile Safari, Chrome on Android), otherwise a download of the .json.
 * Built programmatically; no markup in the feature screen.
 */
export async function shareExport(json: string, fileName: string, title: string): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const blob = new Blob([json], { type: 'application/json' });
  try {
    const file = new File([blob], fileName, { type: 'application/json' });
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return true;
    }
  } catch (error) {
    // The Caller closed the sheet: that is not a failure.
    if (error instanceof Error && error.name === 'AbortError') return true;
  }
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
