import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertPreservedContract, assertPrivacyContract} from './native-platform-contract.mjs';
test('prebuild additions preserve existing native metadata and layout',()=>{
 const before={RVProjectId:'existing-project',RVEndpoint:'https://example.com',RCTNewArchEnabled:true,UIApplicationSceneManifest:{UIApplicationSupportsMultipleScenes:false},orientations:['portrait','landscape']};
 assertPreservedContract(before,{...before,newPluginKey:true,orientations:['portrait','landscape','upside-down']});
 for(const key of ['RVProjectId','RVEndpoint','RCTNewArchEnabled','UIApplicationSceneManifest']){const after={...before};delete after[key];assert.throws(()=>assertPreservedContract(before,after));}
 assert.throws(()=>assertPreservedContract(before,{...before,orientations:['portrait']}));
});
test('privacy reason entries merge without losing existing declarations',()=>{
 const before={NSPrivacyTracking:false,NSPrivacyAccessedAPITypes:[{NSPrivacyAccessedAPIType:'files',NSPrivacyAccessedAPITypeReasons:['existing']}]};
 assertPreservedContract(before,{...before,NSPrivacyAccessedAPITypes:[{NSPrivacyAccessedAPIType:'files',NSPrivacyAccessedAPITypeReasons:['existing','additional']}]});
 assert.throws(()=>assertPreservedContract(before,{...before,NSPrivacyAccessedAPITypes:[]}));
});

test('an empty native dictionary still requires a dictionary after prebuild',()=>{
 assertPreservedContract({}, {newKey:true});
 for(const actual of [undefined,null,[],false,''])assert.throws(()=>assertPreservedContract({},actual));
});

test('moving an SDK-only reason requires the SDK declaration and preserves all app reasons',()=>{
 const entry = reasons => ({NSPrivacyAccessedAPIType:'NSPrivacyAccessedAPICategoryFileTimestamp',NSPrivacyAccessedAPITypeReasons:reasons});
 const manifest = reasons => ({NSPrivacyAccessedAPITypes:[entry(reasons)]});
 const before = manifest(['C617.1','0A2A.1']);
 const after = manifest(['C617.1']);
 assertPrivacyContract(before, after, [manifest(['0A2A.1'])]);
 assert.throws(()=>assertPrivacyContract(before,after,[]));
 assert.throws(()=>assertPrivacyContract(before,manifest([]),[manifest(['0A2A.1'])]));
});
