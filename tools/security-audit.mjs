import {readFile,readdir} from "node:fs/promises";
import {join,relative} from "node:path";
const root=new URL("../",import.meta.url).pathname;
const forbiddenNames=new Set([".env",".dev.vars","id_rsa","id_ed25519"]);
const skipDirs=new Set([".git","node_modules"]);
const secretPatterns=[
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,
  /\b(?:SESSION_SECRET|ADMIN_SECRET|CLOUDFLARE_API_TOKEN|GITHUB_TOKEN)\b\s*[:=]\s*["'][A-Za-z0-9_\-]{24,}["']/
];
const problems=[];
async function walk(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(skipDirs.has(entry.name))continue;
    const path=join(dir,entry.name);
    if(entry.isDirectory()){await walk(path);continue}
    if(forbiddenNames.has(entry.name)){problems.push(`Arquivo sensível rastreável: ${relative(root,path)}`);continue}
    if(!/\.(?:js|mjs|json|jsonc|html|md|yml|yaml|txt|sh)$/i.test(entry.name))continue;
    const text=await readFile(path,"utf8").catch(()=>"");
    for(const pattern of secretPatterns)if(pattern.test(text))problems.push(`Possível segredo em ${relative(root,path)}`);
  }
}
await walk(root);
const index=await readFile(join(root,"site","index.html"),"utf8");
if(!index.includes("Content-Security-Policy"))problems.push("index.html sem Content-Security-Policy.");
if(problems.length){console.error("Falha na auditoria de segurança:");for(const p of problems)console.error("-",p);process.exit(1)}
console.log("Auditoria estática de segurança: OK.");
