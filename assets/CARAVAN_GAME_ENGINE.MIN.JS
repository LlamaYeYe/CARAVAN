(function(){
let seed=((Date.now()&2147483647)^1511508451)>>>0;

function rank(card){return card&15}
function suit(card){return card>>4&3}
function isNumber(card){return rank(card)<=10}





function baseCount(cards){let i,n=0;for(i=0;i<cards.length;i++)if(isNumber(cards[i]))n++;return n}
function lastNumberIndex(cards){let i;for(i=cards.length-1;i>=0;i--)if(isNumber(cards[i]))return i;return-1}
function groupEndIndex(cards,base){let i=base+1;while(i<cards.length&&!isNumber(cards[i]))i++;return i}
function removeGroupAt(cards,base){let end=groupEndIndex(cards,base),n=end-base,i,len;if(n<=0)return;len=cards.length-n;for(i=end;i<cards.length;i++)cards[i-n]=cards[i];while(cards.length>len)cards.pop()}
function groupValueAt(cards,base){let i,v;if(base<0||base>=cards.length||!isNumber(cards[base]))return 0;v=rank(cards[base]);for(i=base+1;i<cards.length&&!isNumber(cards[i]);i++)if(rank(cards[i])===13)v<<=1;return v}
function lastNumberRank(cards){let i=lastNumberIndex(cards);return i>=0?rank(cards[i]):0}
function lastEffectiveSuit(cards){let base=lastNumberIndex(cards),i,end,v;if(base<0)return 0;v=suit(cards[base]);end=groupEndIndex(cards,base);for(i=base+1;i<end;i++)if(rank(cards[i])===12)v=suit(cards[i]);return v}

function computeDirection(cards){
 let i,prev=-1,last=-1,d=0,end;
 for(i=0;i<cards.length;i++)if(isNumber(cards[i])){prev=last;last=i}
 if(prev>=0&&last>=0){if(rank(cards[last])>rank(cards[prev]))d=1;else if(rank(cards[last])<rank(cards[prev]))d=-1}
 if(last>=0&&d){end=groupEndIndex(cards,last);for(i=last+1;i<end;i++)if(rank(cards[i])===12)d=-d}
 return d
}
function refreshDirections(pc,cc,pd,cd){let i;for(i=0;i<3;i++){pd[i]=computeDirection(pc[i]);cd[i]=computeDirection(cc[i])}}
function insertFaceAt(cards,base,card){let at=groupEndIndex(cards,base),i;cards.push(card);for(i=cards.length-1;i>at;i--)cards[i]=cards[i-1];cards[at]=card}
function removeJokerMatches(cards,keepCards,keepBase,targetRank,targetSuit,bySuit){let i;for(i=cards.length-1;i>=0;i--){if(!isNumber(cards[i]))continue;if(cards===keepCards&&i===keepBase)continue;if(bySuit?suit(cards[i])===targetSuit:rank(cards[i])===targetRank)removeGroupAt(cards,i)}}
function playJoker(cards,base,card,pc,cc,pd,cd){process.memory(true);let lane,tr=rank(cards[base]),ts=suit(cards[base]),bySuit=tr===1;insertFaceAt(cards,base,card);for(lane=0;lane<3;lane++){removeJokerMatches(pc[lane],cards,base,tr,ts,bySuit);removeJokerMatches(cc[lane],cards,base,tr,ts,bySuit)}refreshDirections(pc,cc,pd,cd)}
function playFaceCard(caravans,directions,pile,base,card,pc,cc,pd,cd){let cards=caravans[pile];if(base<0||base>=cards.length||!isNumber(cards[base]))return 0;if(rank(card)>13)playJoker(cards,base,card,pc,cc,pd,cd);else if(rank(card)===11){removeGroupAt(cards,base);refreshDirections(pc,cc,pd,cd)}else{insertFaceAt(cards,base,card);directions[pile]=computeDirection(cards)}return 1}

function random32(){if(!seed)seed=1831565813;seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0}
function thinkDelay(){return 1500+random32()%1501}
function shuffleDeck(deck){let i,j,c;for(i=deck.length-1;i>0;i--){j=random32()%(i+1);c=deck[i];deck[i]=deck[j];deck[j]=c}return deck}
function makeDeck(cpu){let deck=new Uint8Array(54),s,r,i=0,o=cpu?1:0;for(s=0;s<4;s++)for(r=1;r<=13;r++)deck[i++]=(((s+o)&3)<<4)|r;deck[i++]=((cpu?2:0)<<4)|14;deck[i]=((cpu?3:1)<<4)|14;return deck}
function ensureOpeningNumbers(deck){let inside=0,search=8,slot,card;for(slot=0;slot<8;slot++)if(isNumber(deck[slot]))inside++;slot=0;while(inside<3&&search<deck.length){while(slot<8&&isNumber(deck[slot]))slot++;while(search<deck.length&&!isNumber(deck[search]))search++;if(slot>=8||search>=deck.length)break;card=deck[slot];deck[slot]=deck[search];deck[search]=card;inside++;slot++;search++}}

function total(cards){let i=0,v=0,g,r;while(i<cards.length){r=rank(cards[i]);if(r<=10){g=r;i++;while(i<cards.length&&rank(cards[i])>10){if(rank(cards[i])===13)g<<=1;i++}v+=g}else i++}return v}
function openingPhase(caravans){return!caravans.openingComplete&&(!caravans[0].length||!caravans[1].length||!caravans[2].length)}
function numberCardCount(cards){let i,n=0;for(i=0;i<cards.length;i++)if(isNumber(cards[i]))n++;return n}
function nthNumberIndex(cards,n){let i,c=0;for(i=0;i<cards.length;i++)if(isNumber(cards[i])){if(c===n)return i;c++}return-1}
function canPlay(caravans,directions,pile,card){let cards=caravans[pile],r=rank(card),last,d;if(openingPhase(caravans))return r<=10&&!cards.length;if(r>10)return 0;if(!cards.length)return 1;last=lastNumberRank(cards);if(r===last)return 0;if(baseCount(cards)===1)return 1;if(suit(card)===lastEffectiveSuit(cards))return 1;d=directions[pile];if(d>0)return r>last;if(d<0)return r<last;return 1}
function playNumberCard(caravans,directions,pile,card){caravans[pile].push(card);directions[pile]=computeDirection(caravans[pile]);if(!caravans.openingComplete&&caravans[0].length&&caravans[1].length&&caravans[2].length)caravans.openingComplete=1}
function laneWinner(a,b){let aq=a>=21&&a<=26,bq=b>=21&&b<=26;if(!aq&&!bq)return 0;if(aq&&!bq)return 1;if(!aq&&bq)return-1;if(a===b)return 0;return a>b?1:-1}
function checkWinner(pc,cc,turnCount,ph,ch){let lane,sold=0,pw=0,cw=0,w;for(lane=0;lane<3;lane++){w=laneWinner(total(pc[lane]),total(cc[lane]));if(w)sold++;if(w>0)pw++;if(w<0)cw++}if(sold===3){if(pw>=2)return"PLAYER";if(cw>=2)return"CPU"}if(turnCount>120||!ph.length&&!ch.length){if(pw>cw)return"PLAYER";if(cw>pw)return"CPU";return"DRAW"}return""}

function chooseCpuMove(hand,cc,cd,pc,pd){let hi,pile,board,base,card,r,cards,current,projected,g,score,best=-10000,move=-1;if(openingPhase(cc)){for(hi=0;hi<hand.length;hi++){card=hand[hi];if(!isNumber(card))continue;for(pile=0;pile<3;pile++){if(cc[pile].length)continue;score=rank(card)*3+(random32()&7);if(score>best){best=score;move=hi<<13|pile<<10}}}return move}for(pile=0;pile<3;pile++)if(total(cc[pile])>26){best=70+(random32()&7);move=-(pile+2);break}for(hi=0;hi<hand.length;hi++){card=hand[hi];r=rank(card);if(r<=10){for(pile=0;pile<3;pile++){if(!canPlay(cc,cd,pile,card))continue;projected=total(cc[pile])+r;score=projected>26?-700-projected:projected>=21?250+projected:projected*3;score+=random32()&7;if(score>best){best=score;move=hi<<13|pile<<10}}continue}for(board=0;board<2;board++)for(pile=0;pile<3;pile++){cards=board?pc[pile]:cc[pile];current=total(cards);for(base=0;base<cards.length;base++){if(!isNumber(cards[base]))continue;g=groupValueAt(cards,base);if(r===13){projected=current+g;score=board?(current>=21&&current<=26&&projected>26?480+current:20):(projected>26?-520:projected>=21?320+projected:projected*3)}else if(r===11){projected=current-g;score=board?(current>=21&&current<=26?430+current:35):(current>26&&projected<=26?360:current>=21&&current<=26?-220:25)}else if(r===12)score=!board&&base===lastNumberIndex(cards)&&rank(cards[cards.length-1])!==12?55:-300;else score=board?25+g*2:-300;score+=random32()&7;if(score>best){best=score;move=hi<<13|board<<12|pile<<10|base+1}}}}return best<-200?-1:move}

return[isNumber,openingPhase,numberCardCount,nthNumberIndex,canPlay,playNumberCard,playFaceCard,checkWinner,makeDeck,shuffleDeck,ensureOpeningNumbers,thinkDelay,chooseCpuMove]})
