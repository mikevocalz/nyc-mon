const { withAppDelegate, withPodfile } = require('expo/config-plugins');
const POD = "  pod 'NYCMonRuntime', :path => '../modules/runtime-heap'";
function podfile(source) {
  if (source.includes(POD)) return source;
  const target = /target ['"][^'"]+['"] do/;
  if (!target.test(source)) throw new Error('Game runtime: application Podfile target not found');
  return source.replace(target, match => `${match}\n${POD}`);
}
function appDelegate(source) {
  if (source.includes('NYCMonRuntimeFactory.create()')) return source;
  const delegate = 'class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {';
  if (!source.includes(delegate)) throw new Error('Game runtime: Expo factory delegate not found');
  return `import NYCMonRuntime\n${source}`.replace(delegate, `${delegate}
  override func createJSRuntimeFactory() -> UnsafeMutableRawPointer {
    NYCMonRuntimeFactory.create()
  }
`);
}
module.exports = config => {
  config = withPodfile(config, mod => { mod.modResults.contents = podfile(mod.modResults.contents); return mod; });
  return withAppDelegate(config, mod => {
    if (mod.modResults.language !== 'swift') throw new Error('Game runtime expects the installed Swift Expo delegate');
    mod.modResults.contents = appDelegate(mod.modResults.contents); return mod;
  });
};
module.exports.podfile = podfile;
module.exports.appDelegate = appDelegate;
