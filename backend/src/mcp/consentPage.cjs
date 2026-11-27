const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function consentPage({ username, clientName, csrf, nonce, protectedKey, pageUrl }) {
  const data = JSON.stringify({ username, csrf, protectedKey, pageUrl }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Connecter Moodle · Centraliz</title>
<style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#101323;color:#eef3ff;font:16px/1.6 system-ui}main{max-width:600px;padding:36px;border:1px solid #414b70;border-radius:24px;background:#191e34}small{color:#6fe5d2;letter-spacing:.15em}h1{font-size:32px;line-height:1.2}p{color:#bdc8df}button,a{font:inherit}button{border:0;border-radius:12px;background:#78ead8;padding:14px 22px;color:#101323;cursor:pointer}button:disabled{opacity:.5}input[type=text]{width:100%;padding:12px;border-radius:8px;background:#101323;color:white;border:1px solid #66718c}label{display:block;margin:20px 0}a{color:#8debdc}#status{white-space:pre-wrap}</style>
<main><small>CENTRALIZ · MOODLE</small><h1>Vos cours, depuis votre assistant.</h1>
<p><strong>${escape(clientName)}</strong> demande l’accès en lecture à vos cours et aux fichiers Moodle du compte <strong>${escape(username)}</strong>.</p>
<p>Votre autorisation durera au maximum 90 jours. Vous pourrez la révoquer ici. Si nécessaire, cette connexion remplacera l’ancien chiffrement ENT par une clé conservée dans ce navigateur et par votre assistant.</p>
<p>Les autres appareils déjà connectés pourront devoir être rééquipés de cette clé. Un serveur compromis pendant une utilisation peut encore intercepter les identifiants.</p>
<p>Utilisez un appareil personnel : ce navigateur conservera la clé. Une sauvegarde sera disponible dans « Gérer mes connexions ».</p>
<label id="keyLabel" hidden>Clé de cet autre appareil (uniquement si ce compte est déjà protégé)<input id="key" type="text" autocomplete="off" spellcheck="false"></label>
<label><input type="checkbox" id="agree"> J’autorise cet assistant et j’accepte le changement de protection de mon compte ENT.</label>
<button id="connect" disabled>Autoriser la lecture Moodle</button> <a href="${escape(pageUrl)}/connections">Gérer mes connexions</a><p id="status" role="status"></p></main>
<script nonce="${nonce}">
const config=${data};
const accountKey='centraliz.entKey:'+config.username;
const genericKey='centraliz.userSecretSalt';
const status=document.getElementById('status');
const connect=document.getElementById('connect');
let currentKey='',candidateKey='';
try {
 currentKey=localStorage.getItem(accountKey)||(config.protectedKey?'':localStorage.getItem(genericKey))||'';
 const previous=localStorage.getItem('centraliz.entKeyPending:'+config.username);
 if(!currentKey&&previous) currentKey=previous;
 document.getElementById('keyLabel').hidden=!config.protectedKey||!!currentKey;
 document.getElementById('agree').onchange=e=>{connect.disabled=!e.target.checked;};
} catch {status.textContent='Le stockage local doit être disponible pour conserver votre clé.';}
connect.onclick=async()=>{
 connect.disabled=true;status.textContent='Connexion en cours…';
 try {
  currentKey=document.getElementById('key').value.trim()||currentKey;
  if(config.protectedKey&&!currentKey) throw Error('Utilisez le navigateur déjà connecté, ou sa clé personnelle.');
  const random=crypto.getRandomValues(new Uint8Array(32));
  candidateKey=config.protectedKey?currentKey:btoa(String.fromCharCode(...random)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  // Save before migration: a lost HTTP response must not lose the only local key.
  localStorage.setItem('centraliz.entKeyPending:'+config.username,candidateKey);
  const response=await fetch(config.pageUrl+'/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf:config.csrf,currentKey,candidateKey})});
  const result=await response.json();
  if(!response.ok) throw Error(result.error||'Connexion impossible.');
  const key=config.protectedKey?currentKey:candidateKey;
  localStorage.setItem(accountKey,key);localStorage.setItem(genericKey,key);
  localStorage.removeItem('centraliz.entKeyPending:'+config.username);
  location.assign(result.redirect);
 } catch(error){status.textContent=error.message;connect.disabled=false;}
};
</script></html>`;
}
function keyBackupControls(username, nonce) {
  const account = JSON.stringify(username).replace(/</g, '\\u003c');
  return `<h2>Ma clé personnelle</h2><p>Conservez cette sauvegarde dans votre gestionnaire de mots de passe. Elle permet de connecter un autre navigateur. Ne la collez jamais dans une conversation avec une IA.</p><button id="backup">Sauvegarder ma clé</button><p><label>Restaurer ma sauvegarde sur cet appareil : <input id="restore" type="file" accept="text/plain,.txt"></label></p><p id="backupStatus" role="status"></p>
<script nonce="${nonce}">document.getElementById('backup').onclick=()=>{
try {
 const user=${account};const key=localStorage.getItem('centraliz.entKey:'+user)||localStorage.getItem('centraliz.entKeyPending:'+user);
 if(!key) throw Error('La clé n’est pas disponible dans ce navigateur.');
 const url=URL.createObjectURL(new Blob([key+'\\n'],{type:'text/plain'}));
 const a=document.createElement('a');a.href=url;a.download='centraliz-cle-personnelle.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}catch(error){document.getElementById('backupStatus').textContent=error.message;}
};
document.getElementById('restore').onchange=async(event)=>{
try {
 const file=event.target.files[0];if(!file)return;
 if(file.size>512)throw Error('Ce fichier ne contient pas une clé personnelle Centraliz.');
 const key=(await file.text()).trim();if(!/^[A-Za-z0-9_-]{43}$/.test(key))throw Error('Format de clé incorrect.');
 localStorage.setItem('centraliz.entKey:'+${account},key);localStorage.setItem('centraliz.userSecretSalt',key);
 document.getElementById('backupStatus').textContent='Clé restaurée sur cet appareil. Rechargez Centraliz puis vérifiez vos cours.';
}catch(error){document.getElementById('backupStatus').textContent=error.message;}
};</script>`;
}
module.exports = { consentPage, escape, keyBackupControls };
