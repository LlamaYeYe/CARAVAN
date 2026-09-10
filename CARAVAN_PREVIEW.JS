(function(api){
var fs=api.fs,b=api.basePath,
removed=0,active=0,waiting=0,waitTimer=0,feedTimer=0,doneTimer=0,
file=0,data=0,path="",level=15,started=0,sampleRate=8000,
onStart=0,onDone=0,
optsFx={encoding:"adpcm",sampleRate:8000,blockAlign:256,overlap:true},
optsStream={encoding:"adpcm",sampleRate:8000,blockAlign:256,overlap:false},
dataOffset=0,dataSize=0,dataRead=0,firstStream=0,
smallLimit=12000,
chunkBytes=2048;

function closeFile(){
    try{if(file)file.close()}catch(error){}
    file=0
}

function cleanupTimers(){
    if(waitTimer){clearTimeout(waitTimer);waitTimer=0}
    if(feedTimer){clearTimeout(feedTimer);feedTimer=0}
    if(doneTimer){clearTimeout(doneTimer);doneTimer=0}
}


function hardStopAudio(){
    /*
     * Pip.audioStartVar() has no public stop handle.
     *
     * Pip.audioStop() only calls STM32_I2S_Stop() when a native file
     * audioStream exists. Open an existing tiny 8 kHz WAV and immediately
     * stop it synchronously. No firmware audio frame can run between these
     * two calls, but audioStop now has a valid stream and therefore forces
     * I2S/DMA to STOP.
     *
     * The next SCROLL sound can then call STM32_I2S_Prepare(16000) and reset
     * the ring/sample rate cleanly instead of mixing 16 kHz data into an
     * 8 kHz Preview engine.
     */
    try{
        Pip.audioStart(b+"CARD_DISCARD_OVERLAP.WAV");
        Pip.audioStop()
    }catch(error){}
}

function scaleAdpcm(buf,vol){
    var bytes,i,p,idx,factor,shift;

    if(!buf||vol>=15)return buf;
    if(vol<=0)return 0;

    bytes=E.toUint8Array(buf);
    factor=vol/15;
    shift=Math.round(Math.log(factor)/Math.log(1.1));

    for(i=0;i+3<bytes.length;i+=256){
        p=bytes[i]|bytes[i+1]<<8;
        if(p&32768)p-=65536;

        p=Math.round(p*factor);
        if(p>32767)p=32767;
        if(p<-32768)p=-32768;
        if(p<0)p+=65536;

        idx=bytes[i+2]+shift;
        if(idx<0)idx=0;
        if(idx>88)idx=88;

        bytes[i]=p&255;
        bytes[i+1]=p>>8&255;
        bytes[i+2]=idx
    }

    return bytes
}

function addCleanStart(buf){
    var src,out;

    if(!buf)return buf;

    src=E.toUint8Array(buf);
    out=new Uint8Array(src.length+256);

    /*
     * First 256 bytes remain zero:
     * one valid 8 kHz IMA-ADPCM block of digital silence.
     *
     * The real preview follows in this SAME audioStartVar buffer, so there
     * is no second playback transition between silence and the sound.
     */
    out.set(src,256);
    return out
}

function getLE32(s,i){
    return s.charCodeAt(i)|
        s.charCodeAt(i+1)<<8|
        s.charCodeAt(i+2)<<16|
        s.charCodeAt(i+3)<<24
}

function openStream(){
    var head,idx;

    try{
        file=E.openFile(b+path,"r");
        if(!file)throw new Error("PREVIEW OPEN");

        head=file.read(256);
        if(!head)throw new Error("PREVIEW HEADER");

        idx=head.indexOf("data");
        if(idx<0||idx+8>head.length)
            throw new Error("PREVIEW DATA");

        dataOffset=idx+8;
        dataSize=getLE32(head,idx+4);
        if(dataSize<0)dataSize+=4294967296;

        file.seek(dataOffset);
        dataRead=0;
        firstStream=1;
        return 1
    }catch(error){
        closeFile();
        return 0
    }
}

function finish(){
    if(!active)return;

    cleanupTimers();
    closeFile();
    active=0;
    waiting=0;
    started=0;
    data=0;

    if(onDone)onDone()
}

function waitForDrain(){
    doneTimer=0;
    if(removed||!active)return;

    try{
        if(Pip.audioIsPlaying()){
            doneTimer=setTimeout(waitForDrain,40);
            return
        }
    }catch(error){}

    finish()
}

function feedStream(){
    var free,remaining,count,part;

    feedTimer=0;
    if(removed||!active||!file)return;

    try{
        /*
         * Keep less than roughly 0.6 sec queued so STOP stays responsive.
         */
        free=Pip.audioGetFree();
        if(free<12000){
            feedTimer=setTimeout(feedStream,35);
            return
        }

        remaining=dataSize-dataRead;
        if(remaining<=0){
            closeFile();
            doneTimer=setTimeout(waitForDrain,40);
            return
        }

        count=Math.min(chunkBytes,remaining);

        if(count>256&&count<remaining)
            count=count-count%256;

        part=file.read(count);
        if(!part||!part.length){
            closeFile();
            doneTimer=setTimeout(waitForDrain,40);
            return
        }

        dataRead+=part.length;
        part=scaleAdpcm(part,level);
        if(!part){
            finish();
            return
        }

        if(firstStream){
            firstStream=0;
            part=addCleanStart(part)
        }

        /*
         * Still uses Pip.audioStartVar like Discard, but overlap:false
         * is required for sequential music chunks so they append rather
         * than mix over each other.
         */
        Pip.audioStartVar(part,optsStream);

        if(!started){
            started=1;
            if(onStart)onStart()
        }

        if(dataRead>=dataSize){
            closeFile();
            doneTimer=setTimeout(waitForDrain,40)
        }else{
            feedTimer=setTimeout(feedStream,35)
        }
    }catch(error){
        finish()
    }
}

function startSmall(){
    var ms,blocks;

    try{
        data=Pip.audioRead(b+path);
        data=scaleAdpcm(data,level);
        if(!data){
            finish();
            return
        }

        data=addCleanStart(data);

        /*
         * Exact clean Discard Preview route, now with one silent ADPCM
         * block attached to the front of the same playback buffer.
         */
        Pip.audioStartVar(data,optsFx);
        started=1;

        if(onStart)onStart();

        blocks=Math.ceil(data.length/256);
        ms=Math.ceil(blocks*505*1000/sampleRate)+100;

        /*
         * After the estimated duration, verify hardware playback is really
         * finished instead of clearing Preview state on a timer alone.
         */
        doneTimer=setTimeout(waitForDrain,ms)
    }catch(error){
        finish()
    }
}

function beginRealPreview(){
    var st,size;

    waitTimer=0;
    waiting=0;
    if(removed||!active)return;

    try{
        st=fs.statSync(b+path);
        size=st&&st.size||0
    }catch(error){
        size=0
    }

    /*
     * The full 16 kHz Coin preview is ~11.5 KB of ADPCM payload. Stream it
     * in small chunks rather than holding the entire preview in JS RAM.
     */
    if(path!=="CAP_COUNT.WAV"&&size>0&&size<=smallLimit){
        startSmall()
    }else{
        if(!openStream()){
            finish();
            return
        }
        feedStream()
    }
}

function confirmUiIdle(){
    waitTimer=0;
    if(removed||!active)return;

    /*
     * Require a second idle check after 30 ms so a just-finished UI sound
     * cannot leave the preview starting on its final DMA transition.
     */
    try{
        if(Pip.audioIsPlaying()){
            waiting=1;
            waitTimer=setTimeout(waitForUiAudio,20);
            return
        }
    }catch(error){}

    waitTimer=setTimeout(beginRealPreview,20)
}

function waitForUiAudio(){
    waitTimer=0;
    if(removed||!active)return;

    try{
        /*
         * Builtin SCROLL/SELECT audio is 16 kHz. Most Caravan previews are
         * 8 kHz; Coin preview is 16 kHz. Always wait until UI audio is idle
         * so the preview starts on a clean audio-engine boundary.
         */
        if(Pip.audioIsPlaying()){
            waiting=1;
            waitTimer=setTimeout(waitForUiAudio,20);
            return
        }
    }catch(error){}

    waiting=1;
    waitTimer=setTimeout(confirmUiIdle,30)
}

function start(p,vol,startedCb,doneCb){
    stop();

    if(removed||vol<=0)return 0;

    path=p;
    level=vol;
    sampleRate=path==="CAP_COUNT.WAV"?16000:8000;
    optsFx.sampleRate=sampleRate;
    optsStream.sampleRate=sampleRate;
    onStart=startedCb||0;
    onDone=doneCb||0;
    active=1;
    waiting=1;
    started=0;

    waitForUiAudio();
    return 1
}

function stop(){
    var wasStarted=started;

    cleanupTimers();
    closeFile();

    /*
     * Critical v0.8.9 fix:
     * do not merely forget a running audioStartVar Preview.
     */
    if(wasStarted)hardStopAudio();

    active=0;
    waiting=0;
    started=0;
    data=0;
    onStart=0;
    onDone=0
}

function remove(){
    removed=1;
    stop()
}

return{
    start:start,
    stop:stop,
    remove:remove,
    isActive:function(){return active},
    isWaiting:function(){return waiting&&!started}
}
});
