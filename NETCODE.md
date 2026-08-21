# NETCODE V9.0.1

## Fluxo

```text
INPUT DO CLIENTE
       ↓
previsão local imediata
       ↓
player-state ~20 Hz
       ↓
Host valida com margem adaptativa
       ↓
┌───────────────────────┐
│ normal → aceita       │
│ soft   → limita       │
│ hard   → rejeita      │
└───────────────────────┘
       ↓
cliente reconcilia suavemente
```

## Normal

Diferença dentro da margem esperada. Nenhuma correção.

## Soft

Diferença maior que a margem normal, mas ainda muito abaixo de um teleporte
claramente impossível. O Host limita o deslocamento e o cliente converge em
vários frames.

## Hard

Reservado para diferenças muito grandes, velocidade absurda ou estado
inválido. Pode haver snap porque nesse caso a prioridade é recuperar um estado
válido.

## Por que a tolerância usa sequência

Os clientes enviam `player-state` aproximadamente a cada 50 ms. Se um pacote
atrasar ou se perder, o próximo pode ter uma sequência maior. A V9.0.1 usa
tanto o tempo medido quanto a diferença de sequência para estimar quanto
movimento legítimo pode ter acontecido.

## Interpolação remota

A posição oficial de outros jogadores chega em passos. O renderizador mantém
uma cópia visual e aproxima essa cópia do estado recebido a cada frame. A
física oficial não é alterada pela interpolação.

## Desligar temporariamente

No console do navegador:

```javascript
NetSmoothing.setGuardMode("off")
```

Para reativar:

```javascript
NetSmoothing.setGuardMode("tolerant")
```

Isso permite um teste A/B sem editar vários arquivos.
