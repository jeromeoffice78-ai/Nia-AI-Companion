import type {VisemeCue} from './visemes';

/** Silent, visibly distinguishable blendshape diagnostic.
 * No audio is played and the samples are NOT phoneme-synchronized speech.
 */
export const DEMO_CYCLE_MS=1800;
export const DEMO_MOUTH_CUES:VisemeCue[]=[
 {startMs:0,endMs:170,viseme:'sil'},
 {startMs:170,endMs:380,viseme:'PP'},
 {startMs:380,endMs:600,viseme:'aa'},
 {startMs:600,endMs:790,viseme:'E'},
 {startMs:790,endMs:980,viseme:'oh'},
 {startMs:980,endMs:1160,viseme:'FF'},
 {startMs:1160,endMs:1360,viseme:'ou'},
 {startMs:1360,endMs:1550,viseme:'aa'},
 {startMs:1550,endMs:1800,viseme:'sil'}
];
