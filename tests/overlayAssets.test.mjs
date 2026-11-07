import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const {packageOverlayAssets}=require('../native-overlay/packageAssets.cjs');

test('native overlay packages a closed, offline module graph and the exact bundled GLB',()=>{
 const directory=mkdtempSync(join(tmpdir(),'nia-overlay-'));
 try{
  const files=packageOverlayAssets(process.cwd(),directory);
  assert.equal(files.length,6);
  for(const name of ['renderer.js','GLTFLoader.js','BufferGeometryUtils.js','three.module.js']){
   const code=readFileSync(join(directory,name),'utf8');
   const parsed=ts.createSourceFile(name,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
   for(const node of parsed.statements){
    if(!ts.isImportDeclaration(node)&&!ts.isExportDeclaration(node))continue;
    const specifier=node.moduleSpecifier?.text;
    if(!specifier)continue;
    assert.ok(specifier.startsWith('./'),'No bare or remote module imports: '+specifier);
    assert.ok(existsSync(resolve(directory,specifier)),'Missing module dependency: '+specifier);
   }
  }
  const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
  assert.equal(hash(join(directory,'nia-character.glb')),hash('assets/nia-character-animated.glb'));
  const html=readFileSync(join(directory,'index.html'),'utf8');
  assert.match(html,/Content-Security-Policy/);
  assert.doesNotMatch(html,/<script[^>]*src=["']https?:/);
  const renderer=readFileSync(join(directory,'renderer.js'),'utf8');
  assert.match(renderer,/renderer\.render\(scene,camera\)/);
  assert.match(renderer,/renderer\.info\.render\.calls<1/);
  assert.match(renderer,/NIA_OVERLAY_READY/);
  assert.match(renderer,/new GLTFLoader\(\)\.parseAsync/);
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('overlay rejects navigation and all resource requests outside its bundled allowlist',()=>{
 const service=readFileSync('native-overlay/NiaOverlayService.java','utf8');
 assert.match(service,/shouldOverrideUrlLoading[^\n]+return true/);
 assert.match(service,/!ASSETS\.contains\(name\)/);
 assert.match(service,/"nia-overlay\.invalid"\.equals\(uri\.getHost\(\)\)/);
 assert.match(service,/setAllowFileAccess\(false\)/);
 assert.match(service,/setAllowContentAccess\(false\)/);
 assert.doesNotMatch(service,/addJavascriptInterface/);
 assert.match(service,/FOREGROUND_SERVICE_TYPE_SPECIAL_USE/);
 assert.match(service,/START_NOT_STICKY/);
 assert.match(service,/web\.destroy\(\)/);
 assert.match(service,/mainHandler\.postDelayed\(loadTimeout,30000\)/);
 assert.match(service,/mainHandler\.removeCallbacks\(loadTimeout\)/);
 assert.match(service,/manager\.removeViewImmediate/);
});
