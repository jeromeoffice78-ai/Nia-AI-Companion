const fs=require('fs');
const path=require('path');
const ts=require('typescript');

/** Reproducible offline WebView payload. No CDN, package download or new dependency. */
function packageOverlayAssets(projectRoot,destination){
 const threePackage=path.dirname(path.dirname(require.resolve('three',{paths:[projectRoot]})));
 const source=path.join(projectRoot,'native-overlay','web');
 fs.mkdirSync(destination,{recursive:true});
 for(const name of ['index.html','renderer.js'])fs.copyFileSync(path.join(source,name),path.join(destination,name));
 fs.copyFileSync(path.join(threePackage,'build','three.module.js'),path.join(destination,'three.module.js'));
 const rebase=text=>text.replace(/from\s+(['"])three\1/g,"from './three.module.js'")
  .replace(/from\s+(['"])\.\.\/utils\/BufferGeometryUtils\.js\1/g,"from './BufferGeometryUtils.js'");
 for(const [name,relative] of [['GLTFLoader.js','examples/jsm/loaders/GLTFLoader.js'],['BufferGeometryUtils.js','examples/jsm/utils/BufferGeometryUtils.js']])
  fs.writeFileSync(path.join(destination,name),rebase(fs.readFileSync(path.join(threePackage,relative),'utf8')));
 const body=ts.transpileModule(fs.readFileSync(path.join(projectRoot,'src','continuousBody.ts'),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.ES2020,target:ts.ScriptTarget.ES2020},
 }).outputText;
 fs.writeFileSync(path.join(destination,'continuousBody.js'),rebase(body));
 fs.copyFileSync(path.join(projectRoot,'assets','nia-character-animated.glb'),path.join(destination,'nia-character.glb'));
 return ['index.html','renderer.js','three.module.js','GLTFLoader.js','BufferGeometryUtils.js','continuousBody.js','nia-character.glb'].map(name=>path.join(destination,name));
}
module.exports={packageOverlayAssets};
