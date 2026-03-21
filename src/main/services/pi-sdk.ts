let piSdkPromise: Promise<typeof import('@mariozechner/pi-coding-agent')> | null = null

export function loadPiSdk(): Promise<typeof import('@mariozechner/pi-coding-agent')> {
  piSdkPromise ??= import('@mariozechner/pi-coding-agent')
  return piSdkPromise
}
