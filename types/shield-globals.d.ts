export {};

declare global {
  interface Window {
    sldwsdk?: {
      SldWSDK: new (config: Record<string, unknown>) => {
        getDeviceResult: (props?: Record<string, unknown>) => Promise<unknown>;
      };
    };
  }
}
