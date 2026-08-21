# Mode API 1

Cada modo fica em `site/modes/<id>/`.

## mode.json

Campos principais:

- `id`: igual ao nome da pasta.
- `name`: nome mostrado no menu.
- `description`: descrição curta.
- `apiVersion`: atualmente `1`.
- `entry`: arquivo JavaScript local, normalmente `./index.js`.
- `enabled`: se `false`, não entra no registro.
- `online` / `offline`: onde o modo aparece.
- `minPlayers` / `maxPlayers`: limites da sala.
- `order`: ordem no menu.
- `accent`: `yellow`, `red` ou `secondary`.
- `bodyClass`: classe CSS opcional.

## Hooks

```javascript
ModeSystem.register({
  id: "meu-modo",

  canStart(ctx) {},
  lobbyStatus(ctx) {},
  hostStart(ctx) {},
  clientSession(ctx) {},
  hostMessage(ctx) {},
  clientMessage(ctx) {},
  offlineStart(ctx) {},
  update(ctx) {},
  render(ctx) {}
});
```

`update()` e `render()` devem retornar `true` quando o plugin assumir
completamente aquela etapa do loop.

## Contexto

O contexto oferece getters e helpers como:

```javascript
ctx.gameType
ctx.gameMode
ctx.role
ctx.roomCode
ctx.playerId
ctx.roster
ctx.state
ctx.remoteState
ctx.setState(...)
ctx.setRemoteState(...)
ctx.sendGame(...)
ctx.sendMode(...)
ctx.setScreen(...)
ctx.showEnd(...)
ctx.hideEnd(...)
ctx.$(...)
```

## Rede própria do modo

Envie:

```javascript
ctx.sendMode({
  type: "checkpoint",
  id: 3
});
```

No Host:

```javascript
hostMessage({message, fromPlayerId}) {
  if (message.type === "checkpoint") {
    // validar ação
    return true;
  }
}
```

No Cliente:

```javascript
clientMessage({message}) {
  return true;
}
```

O carregador recusa manifest/entry com URL externa ou `..`.
