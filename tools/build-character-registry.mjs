import {
  readdir,
  readFile,
  writeFile
} from "node:fs/promises";
import {
  join
} from "node:path";

const root=
  new URL(
    "../site/characters/",
    import.meta.url
  ).pathname;

const entries=
  await readdir(
    root,
    {
      withFileTypes:true
    }
  );

const characters=[];

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
      root,
      entry.name,
      "character.json"
    );

  let manifest;

  try{
    manifest=
      JSON.parse(
        await readFile(
          manifestPath,
          "utf8"
        )
      );
  }catch(error){
    throw new Error(
      `${entry.name}: character.json inválido (${error.message}).`
    );
  }

  if(
    manifest.enabled===
    false
  ){
    continue;
  }

  if(
    !/^[a-z0-9][a-z0-9-]{0,39}$/.test(
      String(
        manifest.id||
        ""
      )
    )
  ){
    throw new Error(
      `${entry.name}: id inválido.`
    );
  }

  if(
    manifest.id!==
    entry.name
  ){
    throw new Error(
      `${entry.name}: o id precisa ser igual ao nome da pasta.`
    );
  }

  characters.push({
    id:manifest.id,
    order:
      Number(
        manifest.order
      )||100,
    manifest:
      `./${entry.name}/character.json`
  });
}

characters.sort(
  (a,b)=>
    a.order-
    b.order||
    a.id.localeCompare(
      b.id
    )
);

const output={
  schemaVersion:1,
  characters:
    characters.map(
      ({id,manifest})=>({
        id,
        manifest
      })
    )
};

await writeFile(
  join(
    root,
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
  `characters/registry.json gerado com ${characters.length} personagem(ns): `+
  characters.map(
    item=>item.id
  ).join(", ")
);
