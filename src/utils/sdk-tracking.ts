const SDK_ID = 'lmts-sdk-ts';

function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && !!process.versions?.node;
}

export function resolveSdkVersion(): string {
  if (typeof __LMTS_SDK_VERSION__ !== 'undefined' && __LMTS_SDK_VERSION__) {
    return __LMTS_SDK_VERSION__;
  }

  return '0.0.0';
}

export function resolveRuntimeToken(): string {
  if (isNodeRuntime()) {
    return `node/${process.versions.node}`;
  }

  return 'runtime/unknown';
}

export function buildSdkTrackingHeaders(): Record<string, string> {
  const sdkVersion = resolveSdkVersion();
  const headers: Record<string, string> = {
    'x-sdk-version': `${SDK_ID}/${sdkVersion}`,
  };

  if (isNodeRuntime()) {
    headers['user-agent'] = `${SDK_ID}/${sdkVersion} (${resolveRuntimeToken()})`;
  }

  return headers;
}

export function buildWebSocketTrackingHeaders(): Record<string, string> {
  if (!isNodeRuntime()) {
    return {};
  }

  return buildSdkTrackingHeaders();
}
