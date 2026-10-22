// Localhost always uses demo emulators; there is no live-project fallback.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,connectAuthEmulator} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getFirestore,connectFirestoreEmulator} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
const config=local?{apiKey:'demo-key',authDomain:'demo-harlan-rules.firebaseapp.com',projectId:'demo-harlan-rules'}:{apiKey:'AIzaSyCyp8bBl38v5Gb8xVsQrfmdnEXisarqBQQ',authDomain:'harlan-learning-hub.firebaseapp.com',projectId:'harlan-learning-hub',appId:'1:341058218983:web:cb24701e93a511fd336b42'};
export const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app);
export const environmentLabel=local?'Local test environment':'Harlan’s Learning Hub';
if(local){connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8080);}
