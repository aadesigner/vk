/** True when a failed query has finished retrying and the UI should show an error state. */
export function showQueryFailure(isError: boolean, isFetching: boolean): boolean {
  return isError && !isFetching;
}

/** Full-page / section error only when there is no cached data to keep showing. */
export function showFatalQueryError(
  isError: boolean,
  isFetching: boolean,
  hasData: boolean,
): boolean {
  return showQueryFailure(isError, isFetching) && !hasData;
}

export function queryErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const data = (error as { data?: { error?: string } }).data;
    if (data?.error) return data.error;
    if ("message" in error && typeof (error as Error).message === "string") {
      return (error as Error).message;
    }
  }
  return fallback;
}
