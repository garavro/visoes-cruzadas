import {
  readdir,
  readFile,
  writeFile
} from "node:fs/promises";
import {
  join,
  relative
} from "node:path";

const root=
  new URL(
    "../site/modes/",
    import.meta.url
  );

const modeRoot=
  root.pathname;

const entries=
  await readdir(
    modeRoot,
    {
      withFileTypes:true
    }
  );

const modes=[];

for(
  const entry
  of entries
){
  if(
    !entry.isDirectory()||
    entry.name.startsWith("_")
  ){
    continue;
  }

  const manifestPath=
    join(
      modeRoot,
      entry.name,
      "mode.json"
    );

  let raw;

  try{
    raw=
      JSON.parse(
        await readFile(
          manifestPath,
          "utf8"
        )
      );
  }catch(error){
    throw new Error(
      `Manifesto inválido em ${entry.name}: ${error.message}`
    );
  }

  if(raw.enabled===false){
    continue;
  }

  if(
    !/^[a-z0-9][a-z0-9-]{0,39}$/.test(
      String(raw.id||"")
    )
  ){
    throw new Error(
      `ID inválido em ${entry.name}/mode.json`
    );
  }

  if(
    String(raw.id)!==
    entry.name
  ){
    throw new Error(
      `A pasta "${entry.name}" deve ter id "${entry.name}" no mode.json.`
    );
  }

  modes.push({
    id:raw.id,
    order:Number(raw.order||100),
    manifest:`./${entry.name}/mode.json`
  });
}

modes.sort(
  (a,b)=>
    a.order-b.order||
    a.id.localeCompare(b.id)
);

const output={
  schemaVersion:1,
  modes:modes.map(
    ({id,manifest})=>({
      id,
      manifest
    })
  )
};

await writeFile(
  join(
    modeRoot,
    "registry.json"
  ),
  JSON.stringify(
    output,
    null,
    2
  )+"\n",
  "utf8"
);

console.log(
  `registry.json gerado com ${modes.length} modo(s): `+
  modes.map(mode=>mode.id).join(", ")
);
