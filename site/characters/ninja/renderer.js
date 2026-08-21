CharacterSystem.register({
  id:"ninja",

  render(ctx,info){
    const{
      w,h,color,stroke,
      animation,time
    }=info;

    const swing=
      animation==="walk"
        ?Math.sin(time*15)
        :0;

    const breathe=
      animation==="idle"
        ?Math.sin(time*3.5)*.8
        :0;

    const jump=
      animation==="jump";
    const fall=
      animation==="fall";

    ctx.lineCap="round";
    ctx.lineJoin="round";

    /*
      Faixas ao vento.
    */
    ctx.strokeStyle=color;
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(w*.77,h*.20+breathe);
    ctx.quadraticCurveTo(
      w*.95,
      h*.15+Math.sin(time*7)*4,
      w*1.05,
      h*.27
    );
    ctx.moveTo(w*.75,h*.23+breathe);
    ctx.quadraticCurveTo(
      w*.97,
      h*.29+Math.cos(time*6)*4,
      w*1.02,
      h*.40
    );
    ctx.stroke();

    /*
      Pernas.
    */
    ctx.strokeStyle=color;
    ctx.lineWidth=Math.max(4,w*.13);
    ctx.beginPath();
    ctx.moveTo(w*.40,h*.69+breathe);
    ctx.lineTo(
      w*.29+swing*5,
      h*.94
    );
    ctx.moveTo(w*.60,h*.69+breathe);
    ctx.lineTo(
      w*.71-swing*5,
      h*.94
    );
    ctx.stroke();

    /*
      Braços.
    */
    ctx.lineWidth=Math.max(3,w*.11);
    ctx.beginPath();

    if(jump){
      ctx.moveTo(w*.32,h*.45);
      ctx.lineTo(w*.15,h*.19);
      ctx.moveTo(w*.68,h*.45);
      ctx.lineTo(w*.85,h*.19);
    }else if(fall){
      ctx.moveTo(w*.30,h*.45);
      ctx.lineTo(w*.08,h*.50);
      ctx.moveTo(w*.70,h*.45);
      ctx.lineTo(w*.92,h*.50);
    }else{
      ctx.moveTo(w*.31,h*.45+breathe);
      ctx.lineTo(w*.15,h*.58-swing*4);
      ctx.moveTo(w*.69,h*.45+breathe);
      ctx.lineTo(w*.85,h*.58+swing*4);
    }

    ctx.stroke();

    /*
      Corpo.
    */
    ctx.fillStyle="#111722";
    ctx.strokeStyle=stroke;
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.roundRect(
      w*.22,
      h*.37+breathe,
      w*.56,
      h*.39,
      6
    );
    ctx.fill();
    ctx.stroke();

    /*
      Cabeça / capuz.
    */
    ctx.fillStyle=color;
    ctx.beginPath();
    ctx.arc(
      w*.50,
      h*.25+breathe,
      w*.28,
      0,
      Math.PI*2
    );
    ctx.fill();
    ctx.stroke();

    /*
      Máscara.
    */
    ctx.fillStyle="#0b1018";
    ctx.beginPath();
    ctx.roundRect(
      w*.22,
      h*.20+breathe,
      w*.56,
      h*.14,
      4
    );
    ctx.fill();

    /*
      Olhos.
    */
    ctx.fillStyle="#fff";
    ctx.beginPath();
    ctx.ellipse(
      w*.38,
      h*.265+breathe,
      3.5,
      1.8,
      0,
      0,
      Math.PI*2
    );
    ctx.ellipse(
      w*.62,
      h*.265+breathe,
      3.5,
      1.8,
      0,
      0,
      Math.PI*2
    );
    ctx.fill();

    /*
      Cinto.
    */
    ctx.fillStyle=color;
    ctx.fillRect(
      w*.22,
      h*.57+breathe,
      w*.56,
      h*.06
    );
  }
});
