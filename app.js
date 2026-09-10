(function(){
const fs=require("fs"),basePath="HOLO/CARAVAN/";
let menu=0,game=0,timer=0,removed=0,ante=50,funds=500,opponent="RINGO";

function clearTimer(){if(timer){clearTimeout(timer);timer=0}}

function unloadMenu(){
    if(menu&&menu.remove)menu.remove();
    menu=0
}

function unloadGame(){
    if(game&&game.remove)game.remove();
    game=0
}

function loadMenu(screen,resultOutcome,resultDelta){
    let sourceCode,menuFactory;

    if(removed)return;
    unloadMenu();
    try{E.defrag()}catch(error){}

    try{
        sourceCode=fs.readFileSync(basePath+"CARAVAN_MENU.MIN.JS");
        menuFactory=eval(sourceCode);
        sourceCode=0;
        menu=menuFactory({
            fs:fs,
            basePath:basePath,
            screen:screen,
            menuSelection:0,
            ante:ante,
            funds:funds,
            opponent:opponent,
            resultOutcome:resultOutcome||"DRAW",
            resultDelta:resultDelta||0,
            onStartGame:requestGame
        });
        menuFactory=0
    }catch(error){
        sourceCode=0;
        menuFactory=0;
        menu=0
    }
}

function requestGame(state){
    if(removed)return;
    ante=state.ante;
    funds=state.funds;
    opponent=state.opponent||opponent;

    clearTimer();
    timer=setTimeout(beginGame,1)
}

function beginGame(){
    let sourceCode,gameFactory,musicApplyFactory,musicApply,sfxApplyFactory,sfxApply;

    timer=0;
    if(removed)return;

    /*
     * Critical memory boundary: remove the entire menu closure before any
     * pre-game audio work or game source loading.
     */
    unloadMenu();
    try{E.defrag()}catch(error){}
    h.clear();

    /*
     * Fast path: compare the selected Music Volume with MUSIC.APPLIED
     * before loading/evaluating the apply helper at all.
     */
    try{
        let cfg=fs.readFileSync(basePath+"SOUND.CFG"),
            applied=fs.readFileSync(basePath+"MUSIC.APPLIED"),
            wanted=cfg&&cfg.length>=6?cfg.charAt(5):"F",
            current=applied&&applied.length?applied.charAt(0):"F";

        if(wanted!=="0"&&wanted!==current){
            sourceCode=fs.readFileSync(basePath+"CARAVAN_MUSIC_APPLY.MIN.JS");
            musicApplyFactory=eval(sourceCode);
            sourceCode=0;

            musicApply=musicApplyFactory({
                fs:fs,
                basePath:basePath
            });
            musicApplyFactory=0;

            if(musicApply&&musicApply.apply)musicApply.apply();
            musicApply=0
        }

        cfg=0;
        applied=0
    }catch(error){
        sourceCode=0;
        musicApplyFactory=0;
        musicApply=0
    }

    /*
     * Card SFX fast path. The gameplay files are only patched when their
     * selected volumes differ from SFX.APPLIED. With unchanged settings,
     * this helper is not read/evaluated at all.
     */
    try{
        let cfg=fs.readFileSync(basePath+"SOUND.CFG"),
            applied=fs.readFileSync(basePath+"SFX.APPLIED"),
            wp=cfg&&cfg.length>=4?cfg.charAt(1):"F",
            wd=cfg&&cfg.length>=4?cfg.charAt(3):"F",
            wc=cfg&&cfg.length>=8?cfg.charAt(7):"F",
            cp=applied&&applied.length>=2?applied.charAt(0):"F",
            cd=applied&&applied.length>=2?applied.charAt(1):"F",
            cc=applied&&applied.length>=3?applied.charAt(2):"F",
            needP=cfg&&cfg.charAt(0)==="1"&&wp!=="0"&&wp!==cp,
            needD=cfg&&cfg.charAt(2)==="1"&&wd!=="0"&&wd!==cd,
            needC=cfg&&cfg.length>=8&&cfg.charAt(6)==="1"&&wc!=="0"&&wc!==cc;

        if(needP||needD||needC){
            sourceCode=fs.readFileSync(basePath+"CARAVAN_SFX_APPLY.MIN.JS");
            sfxApplyFactory=eval(sourceCode);
            sourceCode=0;

            sfxApply=sfxApplyFactory({
                fs:fs,
                basePath:basePath
            });
            sfxApplyFactory=0;

            if(sfxApply&&sfxApply.apply)sfxApply.apply();
            sfxApply=0
        }

        cfg=0;applied=0
    }catch(error){
        sourceCode=0;
        sfxApplyFactory=0;
        sfxApply=0
    }

    /*
     * Go directly into the game. The critical menu-unload defrag above and
     * CARAVAN_GAME's pre-renderer defrag remain.
     */
    try{
        sourceCode=fs.readFileSync(basePath+"CARAVAN_GAME.MIN.JS");
        gameFactory=eval(sourceCode);
        sourceCode=0;

        /*
         * CARAVAN_GAME performs the later pre-renderer defrag itself.
         * Avoid a second back-to-back defrag here.
         */
        game=gameFactory({
            fs:fs,
            basePath:basePath,
            opponent:opponent,
            onFinish:finishGame
        });
        gameFactory=0
    }catch(error){
        sourceCode=0;
        gameFactory=0;
        game=0;
        timer=setTimeout(function(){timer=0;loadMenu(0)},1)
    }
}

function finishGame(result){
    let delta=0;

    if(removed)return;
    unloadGame();

    if(result==="PLAYER"){
        delta=ante;
        funds+=ante
    }else if(result==="CPU"){
        delta=-ante;
        funds-=ante;
        if(funds<0)funds=0
    }

    clearTimer();

    /*
     * Let the just-removed CARAVAN_GAME callback fully unwind before the
     * 9 KB menu module is evaluated again. loadMenu() already performs the
     * required defrag, so do not run a second back-to-back E.defrag here.
     */
    timer=setTimeout(function(){
        timer=0;
        loadMenu(3,result,delta)
    },8)
}

function remove(){
    if(removed)return;
    removed=1;
    clearTimer();
    unloadMenu();
    unloadGame()
}

loadMenu(0);

return{id:"CARAVAN",notDefault:true,fullscreen:true,remove:remove}
});