import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('Nia screen uses Android safe area insets above nav bar and below status bar',()=>{
 const src=read('app/index.tsx');
 assert.match(src,/import \{SafeAreaView\} from 'react-native-safe-area-context'/);
 assert.match(src,/return <SafeAreaView style=\{s.screen\} edges=\{\['top','bottom'\]\}><ScrollView/);
 assert.match(src,/<\/ScrollView><\/SafeAreaView>/);
 assert.match(src,/paddingBottom:28,flexGrow:1/);
 assert.doesNotMatch(src,/paddingTop:48/);
});
test('Android build version code increases for the next installable test APK',()=>{
 const app=JSON.parse(read('app.json'));
 assert.equal(app.expo.version,'0.1.2');
 assert.equal(app.expo.android.versionCode,3);
});
