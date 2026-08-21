CharacterSystem.register({
  id:"alien",

  render(ctx,info){
    const{
      w,h,color,stroke,
      animation,time
    }=info;

    const walk=
      animation==="walk"
        ?Math.sin(time*12)
        :0;

    const float=
      Math.sin(time*4)*1.4;

    const jump=
      animation==="jump";

    ctx.lineCap="round";
    ctx.lineJoin="round";

    /*
      Pernas/tentáculos.
    */
    ctx.strokeStyle=color;
    ctx.lineWidth=Math.max(3,w*.11);

    for(let i=0;i<3;i++){
      const base=
        w*.32+
        i*w*.18;

      ctx.beginPath();
      ctx.moveTo(
        base,
        h*.69+float
      );
      ctx.quadraticCurveTo(
        base+
        (
          i-1
        )*
        4+
        walk*3,
        h*.82,
        base+
        (
          i-1
        )*
        6-
        walk*2,
        h*.96
      );
      ctx.stroke();
    }

    /*
      Corpo.
    */
    ctx.fillStyle=color;
    ctx.strokeStyle=stroke;
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.ellipse(
      w*.50,
      h*.58+float,
      w*.25,
      h*.22,
      0,
      0,
      Math.PI*2
    );
    ctx.fill();
    ctx.stroke();

    /*
      Braços.
    */
    ctx.strokeStyle=color;
    ctx.lineWidth=Math.max(3,w*.09);
    ctx.beginPath();

    if(jump){
      ctx.moveTo(w*.29,h*.54);
      ctx.quadraticCurveTo(
        w*.10,
        h*.37,
        w*.12,
        h*.20
      );
      ctx.moveTo(w*.71,h*.54);
      ctx.quadraticCurveTo(
        w*.90,
        h*.37,
        w*.88,
        h*.20
      );
    }else{
      ctx.moveTo(w*.29,h*.55+float);
      ctx.quadraticCurveTo(
        w*.10,
        h*.59,
        w*.09,
        h*.72+walk*3
      );
      ctx.moveTo(w*.71,h*.55+float);
      ctx.quadraticCurveTo(
        w*.90,
        h*.59,
        w*.91,
        h*.72-walk*3
      );
    }

    ctx.stroke();

    /*
      Cabeça grande.
    */
    ctx.fillStyle=color;
    ctx.strokeStyle=stroke;
    ctx.beginPath();
    ctx.ellipse(
      w*.50,
      h*.27+float,
      w*.36,
      h*.25,
      0,
      0,
      Math.PI*2
    );
    ctx.fill();
    ctx.stroke();

    /*
      Olhos alienígenas.
    */
    ctx.fillStyle="#0a1017";
    ctx.beginPath();
    ctx.ellipse(
      w*.36,
      h*.27+float,
      w*.08,
      h*.12,
      -.28,
      0,
      Math.PI*2
    );
    ctx.ellipse(
      w*.64,
      h*.27+float,
      w*.08,
      h*.12,
      .28,
      0,
      Math.PI*2
    );
    ctx.fill();

    ctx.fillStyle="rgba(255,255,255,.85)";
    ctx.beginPath();
    ctx.arc(
      w*.34,
      h*.23+float,
      1.5,
      0,
      Math.PI*2
    );
    ctx.arc(
      w*.62,
      h*.23+float,
      1.5,
      0,
      Math.PI*2
    );
    ctx.fill();
  }
});
