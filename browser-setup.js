import {auth} from './firebase-client.js';
import {signInAnonymously} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
const status=document.getElementById('status'),code=document.getElementById('code');
try{
 await auth.authStateReady();
 const user=auth.currentUser||(await signInAnonymously(auth)).user;
 // This is an identifier only. Never display/export tokens or self-grant access.
 code.textContent=user.uid;code.hidden=false;
 status.textContent='Browser code for your teacher:';
}catch{status.textContent='Could not check this browser. Please reload this page or ask your teacher for help.';}
