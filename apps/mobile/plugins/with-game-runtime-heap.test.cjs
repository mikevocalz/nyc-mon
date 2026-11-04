const {test}=require('node:test');const assert=require('node:assert/strict');
const {podfile,appDelegate}=require('./with-game-runtime-heap');
test('runtime plugin preserves other pods and delegate lifecycle and is idempotent',()=>{
 const pod="platform :ios, '15.1'\ntarget 'NYCMON' do\n  pod 'ViroReact'\n  post_install do |installer|\n    existing(installer)\n  end\nend\n";
 const next=podfile(pod);assert.equal(podfile(next),next);assert.ok(next.includes("pod 'ViroReact'"));assert.ok(next.includes('existing(installer)'));
 const swift='import Expo\nclass AppDelegate: ExpoAppDelegate {}\nclass ReactNativeDelegate: ExpoReactNativeFactoryDelegate {\n override func bundleURL() -> URL? { Bundle.main.bundleURL }\n}\n';
 const result=appDelegate(swift);assert.equal(appDelegate(result),result);assert.ok(result.includes('class AppDelegate: ExpoAppDelegate {}'));assert.ok(result.includes('override func bundleURL()'));assert.equal((result.match(/createJSRuntimeFactory/g)||[]).length,1);
});
test('unknown generated contracts fail rather than replacing the app structure',()=>{assert.throws(()=>podfile(''));assert.throws(()=>appDelegate(''));});
