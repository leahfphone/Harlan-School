import {signInWithEmailAndPassword,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {auth} from './firebase-client.js';
const $=id=>document.getElementById(id);
onAuthStateChanged(auth,user=>{
 const ready=!!user&&!user.isAnonymous;
 $('login').hidden=ready;$('signedIn').hidden=!ready;
 $('password').value='';$('status').textContent=ready?'Signed in as '+user.email+'. Choose a subject to continue.':'Student sign-in required for assigned work.';
});
$('signin').onclick=async()=>{
 $('signin').disabled=true;
 try{await signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value);}
 catch(e){$('status').textContent='Sign-in failed. Check your email and password. ('+e.code+')';}
 finally{$('signin').disabled=false;$('password').value='';}
};
$('signout').onclick=()=>signOut(auth);
