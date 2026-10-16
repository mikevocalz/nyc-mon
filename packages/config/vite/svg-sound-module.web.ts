// Web stand-in for react-native-svg 15.16's fabric/NativeSvgSoundModule.
// The real module calls TurboModuleRegistry, which react-native-web doesn't
// export, so Rolldown rejects the import. svg only requires it lazily, behind
// `Platform.OS === 'android'`, so on web this is never called.
export default { playTouchSound(): void {} };
