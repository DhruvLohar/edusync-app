// Reexport the native module. On web, it will be resolved to ExpoBleCoreModule.web.ts
// and on native platforms to ExpoBleCoreModule.ts
export { default } from './src/ExpoBleCoreModule';
export { default as ExpoBleCoreView } from './src/ExpoBleCoreView';
export * from  './src/ExpoBleCore.types';
