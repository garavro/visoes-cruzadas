#!/usr/bin/env node
const base=String(process.env.VC_WORKER_URL||"").replace(/\/+$/,"");
const secret=String(process.env.VC_ADMIN_SECRET||"");
if(!base||!secret){
  console.error("Defina VC_WORKER_URL e VC_ADMIN_SECRET no ambiente.");
  process.exit(1);
}
const [command,arg]=process.argv.slice(2);
async function request(path,options={}){
  const response=await fetch(base+path,{
    ...options,
    headers:{
      "content-type":"application/json",
      "authorization":`Bearer ${secret}`,
      ...(options.headers||{})
    }
  });
  const data=await response.json();
  if(!response.ok)throw new Error(data?.error||`HTTP ${response.status}`);
  return data;
}
try{
  if(!command||command==="list"){
    const data=await request("/api/admin/submissions?status=pending&limit=50");
    console.table(data.submissions||[]);
  }else if((command==="approve"||command==="reject")&&arg){
    console.log(await request("/api/admin/submissions/review",{
      method:"POST",
      body:JSON.stringify({map_hash:arg,decision:command==="approve"?"approved":"rejected"})
    }));
  }else{
    console.log("Uso:\n  node server/tools/review-maps.mjs list\n  node server/tools/review-maps.mjs approve HASH\n  node server/tools/review-maps.mjs reject HASH");
  }
}catch(error){console.error(error.message);process.exit(1)}
