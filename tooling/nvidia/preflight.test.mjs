import test from 'node:test';
import assert from 'node:assert/strict';
import { submissionProblems } from './preflight.mjs';
const checks=['account-model-availability','real-nebius-nvidia-inference','two-real-user-sessions','model-selected-real-care-and-persisted-write','independent-session-memory-and-state','explicit-forget-verified'];
function fixture() {
  const sourceCommit='a'.repeat(40);
  return { manifest:{schemaVersion:1,sourceCommit,publicRepositoryUrl:'https://github.com/example/public-slice',hostedDemoUrl:'https://demo.example.com',youtubeUrl:'https://www.youtube.com/watch?v=abcdefghijk',videoDurationSeconds:150,
    license:{spdx:'MIT',scopeApproved:true,thirdPartyNoticesReviewed:true},source:{functionalPublicSlice:true,freshCloneReproduced:true,privateAssetsExcluded:true},
    acceptance:{browserAccountLinking:true,ownerIsolation:true,ageAndServiceTokenDenials:true,forgetAndExport:true,judgeAccessWithoutSSO:true},
    submission:{significantUpdateWritten:true,modelAndNebiusExplained:true,toolFeedbackWritten:true,videoIsPublic:true}},
    proof:{sourceCommit,status:'PASSED',mode:'full-runtime',checks:checks.map((id)=>({id,status:'PASSED'})),receipts:[{provider:'nebius-token-factory',endpoint:'https://api.tokenfactory.nebius.com/v1',requestedModel:'nvidia/Nemotron-3_5-Lightning',returnedModel:'nvidia/Nemotron-3_5-Lightning',responseId:'fixture-only-not-live'}]} };
}
test('accepts complete synthetic structural fixture, not a claim of real evidence',()=>{const {manifest,proof}=fixture();assert.deepEqual(submissionProblems(manifest,proof),[]);});
test('refuses missing fields instead of marking an unfinished entry ready',()=>assert.ok(submissionProblems({schemaVersion:1},null).length>15));
test('provider-only success cannot stand in for full agent acceptance',()=>{const {manifest,proof}=fixture();proof.mode='provider-only';assert.ok(submissionProblems(manifest,proof).some((s)=>s.includes('Full real-runtime')));});
test('refuses a mock or another provider receipt',()=>{const {manifest,proof}=fixture();proof.receipts[0].provider='bedrock';assert.ok(submissionProblems(manifest,proof).some((s)=>s.includes('receipts')));});
test('requires exact proof/source revision',()=>{const {manifest,proof}=fixture();proof.sourceCommit='b'.repeat(40);assert.ok(submissionProblems(manifest,proof).some((s)=>s.includes('submitted source')));});
test('rejects missing mutation proof',()=>{const {manifest,proof}=fixture();proof.checks=proof.checks.filter((c)=>!c.id.includes('persisted-write'));assert.ok(submissionProblems(manifest,proof).some((s)=>s.includes('persisted-write')));});
test('refuses unapproved licensing and leaked private assets',()=>{const {manifest,proof}=fixture();manifest.license.scopeApproved=false;manifest.source.privateAssetsExcluded=false;assert.equal(submissionProblems(manifest,proof).length,2);});
test('Vimeo and three-minute-or-longer footage do not meet the required video shape',()=>{const {manifest,proof}=fixture();manifest.youtubeUrl='https://vimeo.com/123';manifest.videoDurationSeconds=180;assert.equal(submissionProblems(manifest,proof).length,2);});
test('accepts a receipt whose returned id is an alias of the requested NVIDIA model',()=>{const {manifest,proof}=fixture();proof.receipts[0].returnedModel='nvidia/nemotron-3.5-lightning';assert.deepEqual(submissionProblems(manifest,proof),[]);});
test('still refuses a receipt from another model family, vendor or with an empty id',()=>{for (const returnedModel of ['nvidia/nemotron-3-super-120b-a12b','meta/Nemotron-3_5-Lightning','']) {const {manifest,proof}=fixture();proof.receipts[0].returnedModel=returnedModel;assert.ok(submissionProblems(manifest,proof).some((s)=>s.includes('receipts')),returnedModel);}});
