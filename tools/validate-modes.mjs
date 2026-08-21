import {
  readdir,
  readFile,
  access
} from "node:fs/promises";
import {
  join,
  resolve
} from "node:path";

const modeRoot=
  new URL(
    "../site/modes/",
    import.meta.url
  ).pathname;

const entries=
  await readdir(
    modeRoot,
    {
      withFileTypes:true
    }
  );

let count=0;

for(const entry of entries){
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

  const manifest=
    JSON.parse(
      await readFile(
        manifestPath,
        "utf8"
      )
    );

  if(manifest.enabled===false){
    continue;
  }

  if(manifest.apiVersion!==1){
    throw new Error(
      `${entry.name}: apiVersion precisa ser 1.`
    );
  }

  if(manifest.id!==entry.name){
    throw new Error(
      `${entry.name}: id deve ser igual ao nome da pasta.`
    );
  }

  const filesToValidate=[
    String(
      manifest.entry||
      "./index.js"
    ),
    ...(
      Array.isArray(
        manifest.scripts
      )
        ?manifest.scripts.map(
            String
          )
        :[]
    ),
    ...(
      Array.isArray(
        manifest.styles
      )
        ?manifest.styles.map(
            String
          )
        :[]
    )
  ];

  for(
    const file
    of filesToValidate
  ){
    if(
      !file.startsWith("./")||
      file.includes("..")||
      file.includes("://")
    ){
      throw new Error(
        `${entry.name}: caminho inseguro (${file}).`
      );
    }

    await access(
      resolve(
        join(
          modeRoot,
          entry.name
        ),
        file
      )
    );
  }

  count++;
}

console.log(
  `${count} modo(s) validado(s) com sucesso.`
);
