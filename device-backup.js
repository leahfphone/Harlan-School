// Device storage is a convenience; its failure must never block or invalidate
// an acknowledged server write.
export function readBackup(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
export function writeBackup(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
export function removeBackup(key){try{localStorage.removeItem(key);return true;}catch{return false;}}

export function readFlag(key){try{return ['yes','true'].includes(localStorage.getItem(key));}catch{return false;}}
