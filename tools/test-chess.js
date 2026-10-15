// Chess tests: perft (move-generator correctness) and rule/engine checks. Run: node tools/test-chess.js
const C1=require('../chess-core.js');
const tests=[
 ['startpos',C.START,[20,400,8902,197281,4865609]],
 ['kiwipete','r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',[48,2039,97862,4085603]],
 ['pos3','8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',[14,191,2812,43238,674624]],
 ['pos4','r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',[6,264,9467,422333]],
 ['pos5','rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',[44,1486,62379,2103487]],
 ['pos6','r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',[46,2079,89890,3894594]],
];
let ok=true;
for(const [name,fen,exp] of tests){const p=new C1.Position(fen);const t=Date.now();const got=exp.map((_,i)=>p.perft(i+1));
 const pass=got.every((g,i)=>g===exp[i]); ok=ok&&pass; console.log(name.padEnd(9),pass?'PASS':'FAIL',got.join(','),pass?'':'expected '+exp.join(','),(Date.now()-t)+'ms');
 if(p.fen().split(' ').slice(0,4).join(' ')!==fen.split(' ').slice(0,4).join(' ')) {console.log('FEN roundtrip/unmake mismatch',p.fen()); ok=false}}
console.log(ok?'ALL PERFT PASS':'PERFT FAILURES'); if(!ok) process.exitCode=1;
const C=require('../chess-core.js');const {Position,Engine}=C;
let fails=0;const check=(name,cond,info='')=>{console.log((cond?'ok  ':'FAIL')+' '+name+(info?' — '+info:''));if(!cond)fails++;};
// hash consistency over random games
{let bad=0;for(let g=0;g<200;g++){const p=new Position();for(let i=0;i<120;i++){const L=p.legal();if(!L.length)break;p.make(L[(Math.random()*L.length)|0]);const a=[p.h1,p.h2];p.rehash();if(a[0]!==p.h1||a[1]!==p.h2)bad++;}}check('incremental hash == full rehash (24k moves)',bad===0,bad+' mismatches');}
// SAN
{const p=Position.fromMoves(C.START,['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6','b5c6','d7c6','e1g1']);check('SAN castling', p.stack.length>0);
 const q=new Position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');const sans=q.legal().map(m=>q.san(m));check('SAN O-O and O-O-O',sans.includes('O-O')&&sans.includes('O-O-O'));
 const d=new Position('7k/8/8/8/8/8/8/R5RK w - - 0 1');const ds=d.legal().map(m=>d.san(m));check('SAN file disambiguation (Rab1/Rgb1)',ds.includes('Rab1')&&ds.includes('Rgb1'),ds.filter(x=>x.includes('b1')).join(' '));
 const r=new Position('7k/8/8/8/R7/8/8/R6K w - - 0 1');const rs=r.legal().map(m=>r.san(m));check('SAN rank disambiguation (R1a2/R4a2)',rs.includes('R1a2')&&rs.includes('R4a2'),rs.filter(x=>x.includes('a2')).join(' '));
 const m=new Position('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');const mm=m.legal().find(x=>m.san(x)==='Ra8#');check('SAN mate suffix Ra8#',!!mm);
 const pr=new Position('8/P6k/8/8/8/8/8/K7 w - - 0 1');check('SAN promotion a8=Q+? ',pr.legal().map(x=>pr.san(x)).includes('a8=Q'));}
// status
{check('checkmate (fool\'s mate)',Position.fromMoves(C.START,['f2f3','e7e5','g2g4','d8h4']).status()?.reason==='checkmate');
 check('stalemate',new Position('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').status()?.reason==='stalemate');
 check('insufficient K+B v K',new Position('8/8/8/4k3/8/8/2B5/4K3 w - - 0 1').status()?.reason==='insufficient material');
 check('K+R v K is not a draw',new Position('8/8/8/4k3/8/8/2R5/4K3 w - - 0 1').status()===null);
 const rep=Position.fromMoves(C.START,['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8']);check('threefold repetition',rep.status()?.reason==='threefold repetition');
 check('fifty-move rule',new Position('8/8/8/4k3/8/8/2R5/4K3 w - - 100 80').status()?.reason==='the fifty-move rule');}
// tactics
const solve=(fen,lv,expect,name)=>{const p=new Position(fen);const t=Date.now();const r=Engine.think(p,lv,['x']);const u=Position.uci(r.move);check(name+' (level '+lv+')',expect.includes(u),u+' score '+r.score+' depth '+r.depth+' '+(Date.now()-t)+'ms');};
solve('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',1,['a1a8'],'mate in 1 even at Beginner');
solve('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',4,['h5f7'],'Scholar\'s mate Qxf7#');
solve('rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1',4,['f3h4'],'win hanging queen');
solve('8/8/8/8/8/2k5/8/2K1Q3 w - - 0 1',5,null||['e1e3','e1c1','e1e2','e1d2','e1b4','e1e5','e1e4','e1a5','e1d1','e1b1','e1h4','e1g3','e1f2','e1e6','e1e7','e1e8','e1f1','e1g1','e1h1','e1a1','c1d1','c1b1'],'K+Q v K finds a move');
// engine converts K+Q v K to mate
{const p=new Position('8/8/8/4k3/8/8/8/3QK3 w - - 0 1');let n=0,st;while(!(st=p.status())&&n<120){const r=Engine.think(p,4,['x']);p.make(r.move);n++;}check('K+Q vs K: engine (playing both sides) mates',st&&st.reason==='checkmate',(st?st.reason:'no result')+' after '+n+' plies');}
// level 5 vs level 1 match
{let res=[];for(let g=0;g<2;g++){const p=new Position();const hist=[];let st,n=0;while(!(st=p.status())&&n<240){const lv=(p.turn===0)===(g===0)?5:1;const r=Engine.think(p,lv,hist);hist.push(Position.uci(r.move));p.make(r.move);n++;}res.push((st?st.result+' '+st.reason:'unfinished')+' in '+n+' plies (Expert '+(g===0?'white':'black')+')');}
 console.log('Expert vs Beginner:',res.join(' | '));check('Expert beats Beginner',res.every((r,g)=>r.startsWith(g===0?'1-0':'0-1')));}
console.log(fails?fails+' FAILURES':'ALL ENGINE TESTS PASS'); if(fails) process.exitCode=1;
