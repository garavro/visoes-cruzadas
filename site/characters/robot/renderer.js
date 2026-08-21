CharacterSystem.register({
  id:"robot",

  render(ctx,info){
    const{
      w,h,color,stroke,
      animation,time
    }=info;

    const swing=
      animation==="walk"
        ?Math.sin(time*14)
        :0;

    const hover=
      animation==="idle"
        ?Math.sin(time*4)*1
        :0;

    const jump=
      animation==="jump";
    const fall=
      animation==="fall";

    ctx.lineCap="round";
    ctx.lineJoin="round";

    /*
      Antena.
    */
    ctx.strokeStyle=stroke;
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(w*.50,h*.12+hover);
    ctx.lineTo(w*.50,h*.01+hover);
    ctx.stroke();

    ctx.fillStyle="#f7fbff";
    ctx.beginPath();
    ctx.arc(
      w*.50,
      h*.01+hover,
      2.3,
      0,
      Math.PI*2
    );
    ctx.fill();

    /*
      Pernas mecânicas.
    */
    ctx.strokeStyle=color;
    ctx.lineWidth=Math.max(4,w*.14);

    ctx.beginPath();
    ctx.moveTo(w*.35,h*.72+hover);
    ctx.lineTo(
      w*.31+swing*4,
      h*.92
    );
    ctx.moveTo(w*.65,h*.72+hover);
    ctx.lineTo(
      w*.69-swing*4,
      h*.92
    );
    ctx.stroke();

    ctx.fillStyle=stroke;
    ctx.fillRect(
      w*.18+swing*3,
      h*.90,
      w*.24,
      h*.07
    );
    ctx.fillRect(
      w*.58-swing*3,
      h*.90,
      w*.24,
      h*.07
    );

    /*
      Braços.
    */
    ctx.strokeStyle=stroke;
    ctx.lineWidth=Math.max(3,w*.11);
    ctx.beginPath();

    if(jump){
      ctx.moveTo(w*.18,h*.47);
      ctx.lineTo(w*.05,h*.20);
      ctx.moveTo(w*.82,h*.47);
      ctx.lineTo(w*.95,h*.20);
    }else if(fall){
      ctx.moveTo(w*.18,h*.47);
      ctx.lineTo(w*.03,h*.52);
      ctx.moveTo(w*.82,h*.47);
      ctx.lineTo(w*.97,h*.52);
    }else{
      ctx.moveTo(w*.18,h*.48+hover);
      ctx.lineTo(w*.07,h*.61-swing*4);
      ctx.moveTo(w*.82,h*.48+hover);
      ctx.lineTo(w*.93,h*.61+swing*4);
    }

    ctx.stroke();

    /*
      Corpo.
    */
    ctx.fillStyle=color;
    ctx.strokeStyle=stroke;
    ctx.lineWidth=2.2;
    ctx.beginPath();
    ctx.roundRect(
      w*.20,
      h*.39+hover,
      w*.60,
      h*.38,
      4
    );
    ctx.fill();
    ctx.stroke();

    /*
      Cabeça.
    */
    ctx.beginPath();
    ctx.roundRect(
      w*.16,
      h*.12+hover,
      w*.68,
      h*.30,
      5
    );
    ctx.fill();
    ctx.stroke();

    /*
      Visor.
    */
    ctx.fillStyle="#0b1520";
    ctx.beginPath();
    ctx.roundRect(
      w*.25,
      h*.20+hover,
      w*.50,
      h*.13,
      4
    );
    ctx.fill();

    ctx.fillStyle="#f7fbff";
    ctx.fillRect(
      w*.33,
      h*.235+hover,
      3.5,
      3.5
    );
    ctx.fillRect(
      w*.63,
      h*.235+hover,
      3.5,
      3.5
    );

    ctx.fillStyle="rgba(255,255,255,.55)";
    ctx.fillRect(
      w*.43,
      h*.51+hover,
      w*.14,
      h*.05
    );
  }
});
