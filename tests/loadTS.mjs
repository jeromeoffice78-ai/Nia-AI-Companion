import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
export function loadTS(path,stubs={}){
 const filename=resolve(path),module={exports:{}};
 const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const require=name=>Object.hasOwn(stubs,name)?stubs[name]:name.startsWith('.')?loadTS(resolve(dirname(filename),name+'.ts'),stubs):createRequire(import.meta.url)(name);
 new Function('require','module','exports',code)(require,module,module.exports);
 return module.exports;
}
