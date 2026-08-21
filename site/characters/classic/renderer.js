CharacterSystem.register({
  id:"classic",

  render(ctx,info){
    const{
      w,h,color,stroke,
      animation,time
    }=info;

    const walk=
      animation==="walk"
        ?Math.sin(time*13)
        :0;

    const idle=
      animation==="idle"
        ?Math.sin(time*3)*1.2
        :0;

    const jump=
      animation==="jump";
    const fall=
      animation==="fall";

    ctx.lineCap="round";
    ctx.lineJoin="round";

    /*
      Pernas.
    */
    ctx.strokeStyle=color;
    ctx.lineWidth=Math.max(4,w*.15);

    ctx.beginPath();
    ctx.moveTo(w*.38,h*.72+idle);
    ctx.lineTo(
      w*.31+walk*4,
      h*.96
    );
    ctx.moveTo(w*.62,h*.72+idle);
    ctx.lineTo(
      w*.69-walk*4,
      h*.96
    );
    ctx.stroke();

    /*
      Braços.
    */
    ctx.lineWidth=Math.max(3,w*.12);
    ctx.beginPath();

    if(jump){
      ctx.moveTo(w*.25,h*.43);
      ctx.lineTo(w*.08,h*.18);
      ctx.moveTo(w*.75,h*.43);
      ctx.lineTo(w*.92,h*.18);
    }else if(fall){
      ctx.moveTo(w*.25,h*.44);
      ctx.lineTo(w*.04,h*.50);
      ctx.moveTo(w*.75,h*.44);
      ctx.lineTo(w*.96,h*.50);
    }else{
      ctx.moveTo(w*.24,h*.44+idle);
      ctx.lineTo(w*.10,h*.61-walk*3);
      ctx.moveTo(w*.76,h*.44+idle);
      ctx.lineTo(w*.90,h*.61+walk*3);
    }

    ctx.stroke();

    /*
      Corpo.
    */
    ctx.fillStyle=color;
    ctx.strokeStyle=stroke;
    ctx.lineWidth=2;

    ctx.beginPath();
    ctx.roundRect(
      w*.12,
      h*.12+idle,
      w*.76,
      h*.66,
      Math.max(5,w*.17)
    );
    ctx.fill();
    ctx.stroke();

    /*
      Face.
    */
    ctx.fillStyle="#10131b";

    const eyeY=h*.34+idle;

    ctx.beginPath();
    ctx.arc(w*.36,eyeY,2.4,0,Math.PI*2);
    ctx.arc(w*.64,eyeY,2.4,0,Math.PI*2);
    ctx.fill();

    ctx.strokeStyle="rgba(10,15,25,.8)";
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(
      w*.50,
      h*.47+idle,
      w*.13,
      .18,
      Math.PI-.18
    );
    ctx.stroke();
  }
});
