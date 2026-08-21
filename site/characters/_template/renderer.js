/*
  CHARACTER API 1 — template procedural.
  Sem PNG, SVG externo ou spritesheet.
*/

CharacterSystem.register({
  id:"meu-personagem",

  render(ctx,info){
    const{
      w,
      h,
      color,
      stroke,
      animation,
      time
    }=info;

    const bob=
      animation==="idle"
        ?Math.sin(time*3)*1
        :0;

    ctx.fillStyle=color;
    ctx.strokeStyle=stroke;
    ctx.lineWidth=2;

    ctx.beginPath();
    ctx.roundRect(
      3,
      3+bob,
      w-6,
      h-6,
      8
    );
    ctx.fill();
    ctx.stroke();
  }
});
