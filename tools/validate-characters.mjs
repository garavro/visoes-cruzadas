import {
  readdir,
  readFile,
  access
} from "node:fs/promises";
import {
  join,
  resolve
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

let count=0;

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

  const manifest=
    JSON.parse(
      await readFile(
        join(
          root,
          entry.name,
          "character.json"
        ),
        "utf8"
      )
    );

  if(
    manifest.enabled===
    false
  ){
    continue;
  }

  if(
    manifest.apiVersion!==
    1
  ){
    throw new Error(
      `${entry.name}: apiVersion precisa ser 1.`
    );
  }

  if(
    manifest.id!==
    entry.name
  ){
    throw new Error(
      `${entry.name}: id precisa ser igual ao nome da pasta.`
    );
  }

  if(
    manifest.type&&
    manifest.type!==
    "procedural"
  ){
    throw new Error(
      `${entry.name}: nesta versão o tipo aceito é procedural.`
    );
  }

  const entryFile=
    String(
      manifest.entry||
      "./renderer.js"
    );

  if(
    !entryFile.startsWith("./")||
    entryFile.includes("..")||
    entryFile.includes("://")
  ){
    throw new Error(
      `${entry.name}: entry inseguro.`
    );
  }

  await access(
    resolve(
      join(
        root,
        entry.name
      ),
      entryFile
    )
  );

  count++;
}

if(count<1){
  throw new Error(
    "Nenhum personagem habilitado."
  );
}

console.log(
  `${count} personagem(ns) validado(s) com sucesso.`
);
