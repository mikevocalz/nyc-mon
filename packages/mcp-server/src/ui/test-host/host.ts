/// <reference lib="dom" />
/**
 * A minimal MCP Apps host for the boot test (ui.boot.test.ts): one sandboxed
 * iframe on the ext-apps AppBridge, the way a spec host mounts a view. It
 * connects before the view loads, answers ui/initialize with the host
 * context it is given, then sends tool-input and a tool-result.
 */
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';

interface Mount {
  html: string;
  width: number;
  height: number;
  hostContext: Record<string, unknown>;
  result: Record<string, unknown>;
  /** The host rejects every tools/call (transport failure). */
  callFails?: boolean;
}

declare global {
  interface Window {
    mountView: (m: Mount) => Promise<void>;
    calls: unknown[];
    sizes: { width?: number; height?: number }[];
  }
}

window.calls = [];
window.sizes = [];
window.mountView = async ({ html, width, height, hostContext, result, callFails }) => {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.style.cssText = `border:0;display:block;width:${width}px;height:${height}px`;
  document.body.append(frame);
  const bridge = new AppBridge(null, { name: 'boot-test', version: '0' }, { serverTools: {} }, { hostContext } as never);
  bridge.oncalltool = async (params) => {
    window.calls.push(params);
    if (callFails) throw new Error('host lost the server');
    return { content: [], structuredContent: result } as never;
  };
  // ui/notifications/size-changed from the view (App autoResize).
  bridge.onsizechange = (size) => {
    window.sizes.push(size);
  };
  bridge.onrequestdisplaymode = async ({ mode }) => ({ mode });
  bridge.oninitialized = () => {
    void bridge.sendToolInput({ arguments: {} });
    void bridge.sendToolResult({ content: [], structuredContent: result } as never);
  };
  await bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
  frame.srcdoc = html;
};
