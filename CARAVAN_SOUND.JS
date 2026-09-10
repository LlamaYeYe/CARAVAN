(function(api){
var fs=api.fs,b=api.basePath,
cfg=[1,15,1,15,1,15,1,15],
cfgEnable=[0,2,6,4],
cfgVolume=[1,3,7,5],
titles=["PLAYING CARD SOUND","DISCARD SOUND","BOTTLE CAP","LAZY DAYS TIRED"],
previewFiles=["CARD_PLAY_PREVIEW.WAV","CARD_DISCARD_PREVIEW.WAV","CAP_COUNT.WAV","LAZY_DAYS_PREVIEW.WAV"],
screen=0,sel=0,kind=0,edit=0,removed=0,knob=0,
previewEngine=0,previewFactory=0,previewSource=0,
previewing=0,previewWaiting=0;

function loadCfg(){
    var s;
    try{s=fs.readFileSync(b+"SOUND.CFG")}catch(error){s=""}

    if(s&&s.length>=6){
        cfg[0]=s.charAt(0)==="0"?0:1;
        cfg[1]=parseInt(s.charAt(1),16);
        cfg[2]=s.charAt(2)==="0"?0:1;
        cfg[3]=parseInt(s.charAt(3),16);
        cfg[4]=s.charAt(4)==="0"?0:1;
        cfg[5]=parseInt(s.charAt(5),16);
        if(s.length>=8){
            cfg[6]=s.charAt(6)==="0"?0:1;
            cfg[7]=parseInt(s.charAt(7),16)
        }
    }

    if(isNaN(cfg[1])||cfg[1]<0||cfg[1]>15)cfg[1]=15;
    if(isNaN(cfg[3])||cfg[3]<0||cfg[3]>15)cfg[3]=15;
    if(isNaN(cfg[5])||cfg[5]<0||cfg[5]>15)cfg[5]=15;
    if(isNaN(cfg[7])||cfg[7]<0||cfg[7]>15)cfg[7]=15
}

function hex(v){return "0123456789ABCDEF".charAt(v)}

function saveCfg(){
    try{
        fs.writeFileSync(b+"SOUND.CFG",
            ""+cfg[0]+hex(cfg[1])+cfg[2]+hex(cfg[3])+cfg[4]+hex(cfg[5])+
            cfg[6]+hex(cfg[7]))
    }catch(error){}
}

function enabled(){return cfg[cfgEnable[kind]]}
function volume(){return cfg[cfgVolume[kind]]}
function setEnabled(v){cfg[cfgEnable[kind]]=v?1:0}
function setVolume(v){
    if(v<0)v=0;
    if(v>15)v=15;
    cfg[cfgVolume[kind]]=v
}

function header(){
    h.clear().setColor(3).setFontMonofonto16().setFontAlign(0,-1)
     .drawString("VOLUME ADJUSTMENT",240,10)
     .drawLine(18,34,462,34)
     .setFontAlign(-1,-1)
}

function row(text,y,on){
    h.setColor(3).drawString(text,42,y);
    if(on)h.drawRect(28,y-5,452,y+23)
}

function drawList(){
    if(sel<0||sel>4)sel=0;
    header();
    h.drawString("SOUND EFFECTS",42,44).drawLine(42,68,438,68);
    row("Playing Card",76,sel===0);
    row("Discard",104,sel===1);
    row("Bottle Cap",132,sel===2);
    h.drawString("BACKGROUND MUSIC",42,168).drawLine(42,192,438,192);
    row("Lazy Days Tired",200,sel===3);
    row("< Back",238,sel===4)
}

function drawDetail(){
    var text,pt,foot;

    if(sel<0||sel>3)sel=0;
    header();

    h.drawString(titles[kind],42,54).drawLine(42,80,438,80);
    row((kind===3?"Music: ":"Sound: ")+(enabled()?"ON":"OFF"),96,sel===0);

    text=edit?"Volume: < "+volume()+" >":"Volume: "+volume();
    row(text,134,sel===1);

    pt=previewing?"Preview: PLAYING":
       previewWaiting?"Preview: WAIT":"Preview: PLAY";
    row(pt,172,sel===2);
    row("< Back",210,sel===3);

    foot=edit?"Turn left wheel to adjust. Press to finish.":
         kind===3?"Music by Geoff Harvey from Pixabay":
         kind===2?"Sound Distributed From Wand Company PIP-BOY 3000":
         "Sound Effect by Alex from Pixabay";

    h.setFont("6x8",1).drawString(foot,42,258).setFontMonofonto16()
}

function getPreviewEngine(){
    if(previewEngine)return 1;

    try{
        previewSource=fs.readFileSync(b+"CARAVAN_PREVIEW.MIN.JS");
        previewFactory=eval(previewSource);
        previewSource=0;
        previewEngine=previewFactory({fs:fs,basePath:b});
        previewFactory=0;
        return 1
    }catch(error){
        previewSource=0;
        previewFactory=0;
        previewEngine=0;
        return 0
    }
}

function previewStarted(){
    previewWaiting=0;
    previewing=1;
    if(!removed&&screen)drawDetail()
}

function previewDone(){
    previewWaiting=0;
    previewing=0;
    if(!removed&&screen)drawDetail()
}

function startPreview(){
    if(removed||previewing||previewWaiting||volume()<=0)return;
    if(!getPreviewEngine())return;

    /*
     * Preview itself emits no SELECT/CLICK sound.
     */
    previewWaiting=1;
    drawDetail();

    if(!previewEngine.start(
        previewFiles[kind],
        volume(),
        previewStarted,
        previewDone
    )){
        previewWaiting=0;
        drawDetail()
    }
}

function stopPreview(){
    if(previewEngine)previewEngine.stop();
    previewWaiting=0;
    previewing=0
}

function detach(){
    if(knob){
        Pip.removeListener("knob1",onKnob);
        knob=0
    }
}

function back(){
    stopPreview();

    if(previewEngine&&previewEngine.remove)previewEngine.remove();
    previewEngine=0;

    detach();
    if(api.onBack)api.onBack()
}

function onKnob(direction){
    var max;

    if(edit){
        if(direction){
            setVolume(volume()+(direction>0?1:-1));
            Pip.playSound("SCROLL");
            drawDetail()
        }else{
            edit=0;
            saveCfg();

            /*
             * Every volume now applies at playback time in RAM.
             * No audio file is rewritten here.
             */
            drawDetail()
        }
        return
    }

    if(direction){
        var stoppedPreview=previewing||previewWaiting;

        /*
         * SCROLL remains enabled in every Volume Adjustment list/detail
         * submenu. CARAVAN_PREVIEW.stop() now physically stops I2S when a
         * Preview had actually started.
         */
        if(stoppedPreview)stopPreview();

        max=screen?3:4;
        sel+=direction>0?1:-1;
        if(sel<0)sel=max;
        if(sel>max)sel=0;

        if(screen)drawDetail();
        else drawList();

        if(stoppedPreview){
            /*
             * One tiny handoff ensures the forced 8 kHz Preview stop is
             * complete before the 16 kHz firmware SCROLL sound starts.
             */
            setTimeout(function(){
                if(!removed)Pip.playSound("SCROLL")
            },1)
        }else{
            Pip.playSound("SCROLL")
        }
        return
    }

    if(!screen){
        if(sel===4){
            back();
            return
        }

        kind=sel;
        sel=0;
        screen=1;
        drawDetail();
        return
    }

    if(sel===0){
        setEnabled(!enabled());
        saveCfg();
        drawDetail()
    }else if(sel===1){
        stopPreview();
        edit=1;
        drawDetail()
    }else if(sel===2){
        if(previewing||previewWaiting){
            stopPreview();
            drawDetail()
        }else{
            startPreview()
        }
    }else{
        stopPreview();
        screen=0;
        sel=kind;
        drawList()
    }
}

function remove(){
    if(removed)return;
    removed=1;

    if(previewEngine&&previewEngine.remove)previewEngine.remove();

    detach();

    previewEngine=0;
    previewFactory=0;
    previewSource=0
}

loadCfg();
drawList();
Pip.onExclusive("knob1",onKnob);
knob=1;

return{id:"CARAVAN_VOLUME",remove:remove}
});
