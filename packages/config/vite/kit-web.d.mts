import type { PluginOption, UserConfig } from 'vite';

export declare const WEB_EXTENSIONS: string[];

/** Applies the @acme/ui kit's web pipeline (react-native-web, worklets, TypeGPU) to a Vite config. */
export declare function withKitWeb(
  viteConfig: UserConfig,
  options: { appRoot: string; react: PluginOption },
): Promise<UserConfig>;
