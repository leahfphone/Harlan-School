const ns='http://www.w3.org/2000/svg';function svgEl(name,attrs={},content){const el=document.createElementNS(ns,name);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(content!==undefined)el.textContent=content;return el;}
export function diagram(d){
 const svg=svgEl('svg',{viewBox:'0 0 650 260',style:'font:19px Arial,sans-serif',role:'img','aria-label':diagramDescription(d)||d.title||'Textbook diagram'});svg.append(svgEl('title',{},d.title||'Textbook diagram'));
 const text=(x,y,s)=>svg.append(svgEl('text',{x,y,'text-anchor':'middle'},s));
 const line=(x1,y1,x2,y2)=>svg.append(svgEl('line',{x1,y1,x2,y2,stroke:'#17212b','stroke-width':2}));
 if(d.type==='venn'){
  text(325,26,d.title);svg.append(svgEl('circle',{cx:265,cy:150,r:95,fill:'#d9edf8',stroke:'#17212b','stroke-width':2}),svgEl('circle',{cx:385,cy:150,r:95,fill:'#f6efc6','fill-opacity':.65,stroke:'#17212b','stroke-width':2}));
  text(230,52,d.leftLabel);text(420,52,d.rightLabel);for(const [list,x]of[[d.left,225],[d.middle,325],[d.right,425]])list.forEach((s,i)=>text(x,105+i*32,s));
 }else if(d.type==='factorTree'){
  text(325,45,d.top);line(315,58,235,105);line(335,58,415,105);text(225,130,d.left);text(425,130,d.right);
  // Only the originally printed first split is supplied. Further factors are student work.
 }else if(d.type==='numberLine'){
  line(25,115,625,115);for(let n=d.min;n<=d.max;n++){const x=25+(n-d.min)*600/(d.max-d.min);line(x,106,x,124);text(x,153,String(n));}
 }else if(d.type==='modelGroup'){
  const count=d.colored.length,step=135,x0=325-(count-1)*step/2;
  d.colored.forEach((colored,index)=>{const cx=x0+index*step,cy=130;
   if(d.shape==='rect'){for(let part=0;part<d.parts;part++)svg.append(svgEl('rect',{x:cx-55+part*110/d.parts,y:100,width:110/d.parts,height:60,fill:part<colored?'#b6bee8':'white',stroke:'#17212b','stroke-width':2}));}
   else{let vs;if(d.shape==='triangle')vs=[[cx,cy-62],[cx-62,cy+55],[cx+62,cy+55]];else if(d.shape==='hexagon')vs=Array.from({length:6},(_,i)=>{const a=(i*60)*Math.PI/180;return [cx+58*Math.cos(a),cy+58*Math.sin(a)];});
    for(let part=0;part<d.parts;part++){const fill=part<colored?(d.shape==='circle'?'#efdbb9':'#b6bee8'):'white';if(vs){svg.append(svgEl('polygon',{points:[[cx,cy],vs[part],vs[(part+1)%d.parts]].map(p=>p.join(',')).join(' '),fill,stroke:'#17212b','stroke-width':2}));}else{const a=(-90+part*360/d.parts)*Math.PI/180,b=(-90+(part+1)*360/d.parts)*Math.PI/180;svg.append(svgEl('path',{d:`M ${cx} ${cy} L ${cx+58*Math.cos(a)} ${cy+58*Math.sin(a)} A 58 58 0 0 1 ${cx+58*Math.cos(b)} ${cy+58*Math.sin(b)} Z`,fill,stroke:'#17212b','stroke-width':2}));}}
   }
  });
 }else if(d.type==='pie'){
  text(180,23,d.title);let angle=d.start||-90;for(const item of d.items){const a=angle*Math.PI/180,b=(angle+item.value*3.6)*Math.PI/180;svg.append(svgEl('path',{d:`M 180 135 L ${180+92*Math.cos(a)} ${135+92*Math.sin(a)} A 92 92 0 ${item.value>50?1:0} 1 ${180+92*Math.cos(b)} ${135+92*Math.sin(b)} Z`,fill:item.color,stroke:'#17212b','stroke-width':2}));angle+=item.value*3.6;}d.items.forEach((item,i)=>{svg.append(svgEl('rect',{x:325,y:55+i*43,width:20,height:20,fill:item.color,stroke:'#17212b'}));svg.append(svgEl('text',{x:355,y:72+i*43},item.label+': '+item.value+'%'));});
 }else if(d.type==='clock'){
  svg.append(svgEl('circle',{cx:325,cy:130,r:105,fill:'white',stroke:'#17212b','stroke-width':3}),svgEl('circle',{cx:325,cy:130,r:4,fill:'#17212b'}));for(let n=1;n<=12;n++){const a=(n*30-90)*Math.PI/180;text(325+88*Math.cos(a),137+88*Math.sin(a),String(n));}
 }else if(d.type==='geometry'){
  const arrow=(x,y,a)=>svg.append(svgEl('polygon',{points:[[x,y],[x-12*Math.cos(a)+5*Math.sin(a),y-12*Math.sin(a)-5*Math.cos(a)],[x-12*Math.cos(a)-5*Math.sin(a),y-12*Math.sin(a)+5*Math.cos(a)]].map(p=>p.join(',')).join(' '),fill:'#17212b'}));
  if(d.grid){const g=d.grid,cx=g.cellX||g.cell,cy=g.cellY||g.cell;for(let i=0;i<=g.cols;i++)svg.append(svgEl('line',{x1:g.x+i*cx,y1:g.y,x2:g.x+i*cx,y2:g.y+g.rows*cy,stroke:'#a8bfd1','stroke-width':1}));for(let i=0;i<=g.rows;i++)svg.append(svgEl('line',{x1:g.x,y1:g.y+i*cy,x2:g.x+g.cols*cx,y2:g.y+i*cy,stroke:'#a8bfd1','stroke-width':1}));}
  if(d.protractor){svg.append(svgEl('path',{d:'M 110 225 A 190 190 0 0 1 490 225 L 110 225 Z',fill:'#edf5f9',stroke:'#17212b','stroke-width':2}));for(let a=0;a<=180;a++){const r=a%10===0?173:a%5===0?179:184,t=a*Math.PI/180;line(300+r*Math.cos(t),225-r*Math.sin(t),300+190*Math.cos(t),225-190*Math.sin(t));if(a%10===0){for(const [radius,label]of [[158,a],[137,180-a]])svg.append(svgEl('text',{x:300+radius*Math.cos(t),y:a%180===0?215:229-radius*Math.sin(t),'text-anchor':'middle',style:'font-size:12px'},label));}}}
  for(const c of d.circles||[])svg.append(svgEl('circle',{cx:c.x,cy:c.y,r:c.r,fill:'white',stroke:'#17212b','stroke-width':2}));
  (d.polygons||[]).forEach((p,i)=>{svg.append(svgEl('polygon',{points:p.map(p=>p.join(',')).join(' '),fill:d.colors?.[i]||'#e1edf5'}));p.forEach((a,j)=>{const b=p[(j+1)%p.length];svg.append(svgEl('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#17212b','stroke-width':2,...((d.hiddenPolygonEdges||[]).some(([pi,ei])=>pi===i&&ei===j)?{'stroke-dasharray':'6 5'}:{})}));});});
  for(const path of d.paths||[])svg.append(svgEl('path',{d:path,fill:'#e1edf5',stroke:'#17212b','stroke-width':2}));
  for(const [index,l] of (d.lines||[]).entries()){if(d.hiddenLineIndices?.includes(index))svg.append(svgEl('line',{x1:l.x1,y1:l.y1,x2:l.x2,y2:l.y2,stroke:'#17212b','stroke-width':2,'stroke-dasharray':'6 5'}));else line(l.x1,l.y1,l.x2,l.y2);const a=Math.atan2(l.y2-l.y1,l.x2-l.x1);if(l.arrows==='both')arrow(l.x1,l.y1,a+Math.PI);if(l.arrows==='both'||l.arrows==='end')arrow(l.x2,l.y2,a);}
  for(const l of d.hiddenLines||[])svg.append(svgEl('line',{x1:l.x1,y1:l.y1,x2:l.x2,y2:l.y2,stroke:'#17212b','stroke-width':2,'stroke-dasharray':'6 5'}));
  const p=d.polygons?.[0];if(p){for(const index of d.marks||[]){const a=p[index],b=p[(index+1)%p.length],dx=b[0]-a[0],dy=b[1]-a[1],r=Math.hypot(dx,dy);line((a[0]+b[0])/2-dy/r*8,(a[1]+b[1])/2+dx/r*8,(a[0]+b[0])/2+dy/r*8,(a[1]+b[1])/2-dx/r*8);}for(const index of d.rightCorners||[]){const a=p[(index+p.length-1)%p.length],b=p[index],c=p[(index+1)%p.length],u=[a[0]-b[0],a[1]-b[1]],v=[c[0]-b[0],c[1]-b[1]],ru=Math.hypot(...u),rv=Math.hypot(...v),x=b[0]+u[0]*17/ru,y=b[1]+u[1]*17/ru,xx=b[0]+v[0]*17/rv,yy=b[1]+v[1]*17/rv;line(x,y,x+v[0]*17/rv,y+v[1]*17/rv);line(xx,yy,xx+u[0]*17/ru,yy+u[1]*17/ru);}}
  for(const p of d.dots||[]){svg.append(svgEl('circle',{cx:p.x,cy:p.y,r:3.5,fill:'#17212b'}));if(p.label)svg.append(svgEl('text',{x:p.x+(p.dx??10),y:p.y+(p.dy??-12)},p.label));}for(const t of d.texts||[])text(t.x,t.y,t.text);
 }else if(d.type==='coordinatePlane'){
  svg.setAttribute('viewBox','0 0 650 490');svg.style.maxHeight='none';const step=420/(d.max-d.min),xx=x=>115+(x-d.min)*step,yy=y=>440-(y-d.min)*step,ox=xx(0),oy=yy(0);for(let n=d.min;n<=d.max;n++){svg.append(svgEl('line',{x1:xx(n),y1:20,x2:xx(n),y2:440,stroke:'#becbd5','stroke-width':1}),svgEl('line',{x1:115,y1:yy(n),x2:535,y2:yy(n),stroke:'#becbd5','stroke-width':1}));if(n!==0&&(d.min>=0||Math.abs(n)<d.max)){svg.append(svgEl('text',{x:xx(n),y:oy+22,'text-anchor':'middle',style:'font-size:16px'},n),svgEl('text',{x:ox-10,y:yy(n)+6,'text-anchor':'end',style:'font-size:16px'},n));}}
  line(95,oy,555,oy);line(ox,460,ox,0);text(568,oy+8,'x');text(ox+20,16,'y');text(ox-12,oy+22,'0');for(const [x1,y1,x2,y2]of d.segments||[])svg.append(svgEl('line',{x1:xx(x1),y1:yy(y1),x2:xx(x2),y2:yy(y2),stroke:'#2176a6','stroke-width':3}));for(const p of d.points){svg.append(svgEl('circle',{cx:xx(p.x),cy:yy(p.y),r:4,fill:'#17212b'}),svgEl('text',{x:xx(p.x)+8,y:yy(p.y)-10},p.label));}
 }else if(d.type==='figureRow'){
  const rows=Math.ceil(d.figures.length/2);svg.setAttribute('viewBox',`0 0 650 ${rows*300}`);svg.style.maxHeight='none';d.figures.forEach((f,i)=>{const child=diagram(f);child.setAttribute('viewBox','60 0 530 260');child.setAttribute('x',(i%2)*330);child.setAttribute('y',Math.floor(i/2)*300+25);child.setAttribute('width','320');child.setAttribute('height','260');child.style.width='320px';child.style.maxHeight='none';child.querySelectorAll('text').forEach(t=>t.style.fontSize='26px');svg.append(child);if(d.labels?.[i])text((i%2)*330+160,Math.floor(i/2)*300+24,d.labels[i]);});
 }else if(d.type==='angleSet'){
  svg.setAttribute('viewBox','0 0 650 430');svg.style.maxHeight='none';d.items.forEach((item,i)=>{const child=diagram({type:'geometry',lines:item.rays});child.setAttribute('viewBox','60 0 530 260');child.setAttribute('x',(i%3)*215);child.setAttribute('y',Math.floor(i/3)*215);child.setAttribute('width','215');child.setAttribute('height','175');child.style.width='215px';svg.append(child);text((i%3)*215+112,Math.floor(i/3)*215+198,[item.label,item.given].filter(Boolean).join(': '));});
 }else if(d.type==='letterChoices'){
  const labels=['Original','A','B','C'];for(let i=0;i<4;i++){const x=82+i*163;text(x,35,labels[i]);const g=svgEl('g',{transform:`translate(${x} 150) ${i?d.transforms[i-1]:''}`});g.append(svgEl('text',{'text-anchor':'middle','dominant-baseline':'central',style:'font:bold 96px Arial,sans-serif'},d.letter));svg.append(g);}
 }else if(d.type==='streetMap'){
  svg.setAttribute('viewBox','0 0 650 380');svg.style.maxHeight='none';svg.append(svgEl('rect',{x:100,y:10,width:495,height:350,fill:'#e3efd9'}));const road=(points)=>svg.append(svgEl('polyline',{points,fill:'none',stroke:'white','stroke-width':28,'stroke-linejoin':'round'}));for(const points of ['105,100 595,100','105,300 595,300','585,10 585,360','105,240 170,240 405,100','349,6 405,100','200,360 490,185 530,165'])road(points);svg.append(svgEl('line',{x1:75,y1:10,x2:75,y2:365,stroke:'#78b9d6','stroke-width':15}));text(285,106,'Reynolds Way');text(345,306,'Purcell Avenue');for(const [x,y,label,angle]of [[55,195,'Goldberg Canal',-90],[610,190,'Foster Boulevard',-90],[285,175,'Rydberg Lane',-31],[373,50,'Russell Drive',59],[382,257,'King Road',-31]])svg.append(svgEl('text',{x,y,transform:`rotate(${angle} ${x} ${y})`,'text-anchor':'middle',style:'font-size:17px'},label));
 }else if(d.type==='markedLine'){
  const steps=(d.max-d.min)*d.partsPerWhole;line(45,115,605,115);for(let i=0;i<=steps;i++){const x=55+i*540/steps;line(x,107,x,123);if(i%d.partsPerWhole===0)text(x,154,d.min+i/d.partsPerWhole);}svg.append(svgEl('circle',{cx:55+d.point*540/steps,cy:115,r:5,fill:'#007caf'}));
 }else if(d.type==='magicSquare'){
  for(let r=0;r<3;r++)for(let c=0;c<3;c++)svg.append(svgEl('rect',{x:220+c*70,y:25+r*70,width:70,height:70,fill:'#e1f1fa',stroke:'#17212b','stroke-width':2}));text(325,137,d.center);
 }else if(d.type==='trianglePuzzle'){
  line(325,30,180,220);line(180,220,470,220);line(470,220,325,30);for(const [x,y]of [[325,30],[252.5,125],[397.5,125],[180,220],[325,220],[470,220]])svg.append(svgEl('circle',{cx:x,cy:y,r:24,fill:'white',stroke:'#17212b','stroke-width':2}));
 }else if(d.type==='train'){
  svg.setAttribute('viewBox','0 0 650 390');d.cars.forEach((car,i)=>{const x=25+(i%3)*210,y=30+Math.floor(i/3)*190;svg.append(svgEl('rect',{x,y,width:175,height:65,rx:i===3?20:3,fill:['#b34b4b','#efe4cb','#37804a','#666','#1675a4','#888'][i],stroke:'#17212b','stroke-width':2}));for(const cx of[x+28,x+147])svg.append(svgEl('circle',{cx,cy:y+73,r:12,fill:'#333'}));text(x+87,y+115,car.label);text(x+87,y+145,car.length);});
 }else if(d.type==='modelChoices'){
  svg.setAttribute('viewBox','0 0 650 320');d.models.forEach((parts,i)=>{const x=65+(i%2)*315,y=25+Math.floor(i/2)*160,w=240;svg.append(svgEl('rect',{x,y,width:w,height:45,fill:'#d9edf8',stroke:'#17212b','stroke-width':2}));text(x-23,y+31,String.fromCharCode(65+i)+'.');text(x+w/2,y+30,d.whole);let offset=0;const sum=parts.reduce((n,p)=>n+p,0);parts.forEach(p=>{const width=w*p/sum;svg.append(svgEl('rect',{x:x+offset,y:y+45,width,height:45,fill:'white',stroke:'#17212b','stroke-width':2}));text(x+offset+width/2,y+75,p);offset+=width;});});
 }else if(d.type==='barGraph'){
  svg.setAttribute('viewBox','0 0 650 360');text(340,23,d.title);const y=v=>280-(v-44)*230/56;for(const tick of d.ticks){line(70,y(tick),620,y(tick));text(43,y(tick)+6,tick);}line(70,40,70,305);line(70,305,620,305);text(43,310,'0');svg.append(svgEl('path',{d:'M 63 294 l 14 -5 l -14 -5',fill:'none',stroke:'#17212b','stroke-width':2}));d.items.forEach((item,i)=>{const x=98+i*103;svg.append(svgEl('rect',{x,y:y(item.value),width:35,height:280-y(item.value),fill:'#1675a4'}));text(x+17,326,item.label);});text(340,355,d.xLabel);svg.append(svgEl('text',{x:17,y:180,transform:'rotate(-90 17 180)','text-anchor':'middle'},d.yLabel));
 }else if(d.type==='horizontalBars'){
  svg.setAttribute('viewBox','0 0 800 390');text(475,24,d.title);const x=v=>270+v*500/d.max;for(const tick of d.ticks){line(x(tick),45,x(tick),325);svg.append(svgEl('text',{x:x(tick),y:350,'text-anchor':'middle',style:'font-size:14px'},tick.toLocaleString('en-US')));}line(270,45,270,325);line(270,325,770,325);d.items.forEach((item,i)=>{const y=65+i*52;svg.append(svgEl('text',{x:255,y:y+19,'text-anchor':'end',style:'font-size:17px'},item.label));svg.append(svgEl('rect',{x:270,y,width:x(item.value)-270,height:24,fill:'#1675a4'}));});text(510,382,d.xLabel);svg.append(svgEl('text',{x:20,y:180,transform:'rotate(-90 20 180)','text-anchor':'middle'},d.yLabel));
 }else if(d.type==='barModel'){
  svg.append(svgEl('rect',{x:85,y:60,width:480,height:60,fill:'#d9edf8',stroke:'#17212b','stroke-width':2}));text(325,98,d.whole);d.parts.forEach((part,i)=>{const w=480/d.parts.length;svg.append(svgEl('rect',{x:85+i*w,y:120,width:w,height:60,fill:'white',stroke:'#17212b','stroke-width':2}));text(85+(i+.5)*w,158,part);});
 }else if(d.type==='grid'){
  const cell=Math.min(44,200/d.rows),x0=325-d.cols*cell/2,y0=30;for(let r=0;r<d.rows;r++)for(let c=0;c<d.cols;c++)svg.append(svgEl('rect',{x:x0+c*cell,y:y0+r*cell,width:cell,height:cell,fill:d.shaded.includes(r*d.cols+c)?'#b6bee8':'white',stroke:'#17212b','stroke-width':2}));
 }else if(d.type==='circles'||d.type==='triangleSet'){
  const step=75,x0=325-(d.cols-1)*step/2;for(let r=0;r<d.rows;r++)for(let c=0;c<d.cols;c++){const x=x0+c*step,y=90+r*70,fill=d.shaded.includes(r*d.cols+c)?(d.color||'#b6bee8'):'white';svg.append(d.type==='circles'?svgEl('circle',{cx:x,cy:y,r:23,fill,stroke:'#17212b','stroke-width':2}):svgEl('polygon',{points:`${x},${y-25} ${x-28},${y+24} ${x+28},${y+24}`,fill,stroke:'#17212b','stroke-width':2}));}
 }else if(d.type==='sectors'){
  let vertices;if(d.shape==='triangle'){vertices=[[325,40],[220,220],[430,220]];const center=[325,160],edge=[];for(let i=0;i<3;i++){const a=vertices[i],b=vertices[(i+1)%3];edge.push(a,[(a[0]+b[0])/2,(a[1]+b[1])/2]);}vertices=edge;vertices.forEach((a,i)=>{const b=vertices[(i+1)%6];svg.append(svgEl('polygon',{points:[center,a,b].map(p=>p.join(',')).join(' '),fill:d.shaded.includes(i)?'#b6bee8':'white',stroke:'#17212b','stroke-width':2}));});}
  else{vertices=Array.from({length:d.parts},(_,i)=>{const a=(-112.5+i*360/d.parts)*Math.PI/180;return [325+95*Math.cos(a),130+95*Math.sin(a)];});vertices.forEach((a,i)=>svg.append(svgEl('polygon',{points:[[325,130],a,vertices[(i+1)%d.parts]].map(p=>p.join(',')).join(' '),fill:d.shaded.includes(i)?'#a8d5d8':'white',stroke:'#17212b','stroke-width':2})));}
 }else if(d.type==='fractionLine'){
  line(60,115,590,115);for(let i=0;i<=d.parts;i++){const x=75+i*500/d.parts;line(x,106,x,124);if(d.labels?.[i]||(d.points||[]).includes(i))svg.append(svgEl('circle',{cx:x,cy:115,r:5,fill:'#007caf'}));if(d.labels?.[i])text(x,155,d.labels[i]);}text(75,88,'0');text(575,88,'1');if(d.endpointFractions){text(75,170,'0/'+d.parts);text(575,170,d.parts+'/'+d.parts);}
 }else if(d.type==='figureSet'){
  const rows=[['ot','ot','ot'],['pr','pt','pt'],['pt','or','pt']];rows.forEach((row,r)=>row.forEach((shape,c)=>{const x=225+c*100,y=45+r*78,fill=shape[0]==='o'?'#eea26d':'#b5a0dc';svg.append(shape[1]==='r'?svgEl('rect',{x:x-37,y:y-23,width:74,height:46,fill,stroke:'#17212b','stroke-width':2}):svgEl('polygon',{points:`${x},${y-30} ${x-34},${y+28} ${x+34},${y+28}`,fill,stroke:'#17212b','stroke-width':2}));}));
 }else if(d.type==='solidRectangle'){
  svg.append(svgEl('rect',{x:170,y:90,width:d.width||160,height:42,fill:'#2176a6',stroke:'#17212b','stroke-width':2}));
 }else if(d.type==='counters'){
  const x0=325-(d.count-1)*57/2;for(let i=0;i<d.count;i++){svg.append(svgEl('circle',{cx:x0+i*57,cy:120,r:22,fill:d.sign==='+'?'#17212b':'#a32327',stroke:'#17212b','stroke-width':2}));svg.append(svgEl('text',{x:x0+i*57,y:127,'text-anchor':'middle',style:'fill:white'},d.sign));}
 }
 return svg;
}
export function diagramDescription(d){
 if(!d)return '';
 if(d.type==='geometry')return d.description||'Textbook geometric figure.';
 if(d.type==='coordinatePlane')return `Coordinate grid from ${d.min} to ${d.max} on each axis, with unit squares. Plotted points: `+d.points.map(p=>`${p.label}: ${p.x} on the horizontal axis, ${p.y} on the vertical axis`).join('; ')+'.';
 if(d.type==='figureRow')return d.figures.map((f,i)=>(d.labels?.[i]||'Figure '+(i+1))+': '+diagramDescription(f)).join(' ');
 if(d.type==='angleSet')return 'Given angles: '+d.items.map(i=>[i.label,i.given].filter(Boolean).join(' ')).join(', ')+'.';
 if(d.type==='letterChoices')return 'Original letter '+d.letter+' and three shown transformed versions labeled A, B and C.';
 if(d.type==='streetMap')return 'Street map: Reynolds Way and Purcell Avenue run left to right. Foster Boulevard runs top to bottom on the right. Goldberg Canal runs top to bottom on the left. Rydberg Lane runs diagonally up to the right from the canal and meets Reynolds Way. Russell Drive meets the same junction from diagonally above-left. King Road runs diagonally up to the right, crossing Purcell Avenue and ending below Reynolds Way.';
 if(d.type==='markedLine')return `Number line from ${d.min} to ${d.max}, each whole divided into ${d.partsPerWhole} equal intervals. A point is marked ${d.point} intervals after ${d.min}.`;
 if(d.type==='magicSquare')return 'A three-by-three square. Only the center cell is given: '+d.center+'. All other cells are empty.';
 if(d.type==='trianglePuzzle')return 'A triangle with empty circles at the three vertices and the midpoint of each side: six circles in total.';
 if(d.type==='train')return 'Train cars, in order: '+d.cars.map(c=>c.label+', '+c.length).join('; ')+'.';
 if(d.type==='modelChoices')return d.models.map((parts,i)=>String.fromCharCode(65+i)+': whole '+d.whole+'; parts '+parts.join(', ')).join('. ')+'.';
 if(d.type==='barGraph'||d.type==='horizontalBars')return d.title+'. Axes: '+d.xLabel+'; '+d.yLabel+'. Tick marks: '+d.ticks.join(', ')+'. Bar endpoints are approximately '+d.items.map(i=>i.label+' '+i.value).join('; ')+'.';
if(d.type==='barModel')return `Bar model: whole ${d.whole}; equal parts labeled ${d.parts.join(', ')}.`;if(d.type==='grid')return `Rectangle with ${d.rows} row(s) and ${d.cols} columns; ${d.shaded.length} cells colored.`;
 if(d.type==='circles'||d.type==='triangleSet')return `${d.rows} row(s) of ${d.cols} ${d.type==='circles'?'circles':'triangles'}; ${d.shaded.length} colored.`;
 if(d.type==='sectors')return `${d.shape} divided into ${d.parts} equal parts; ${d.shaded.length} colored.`;
 if(d.type==='fractionLine')return `Number line from 0 to 1 with ${d.parts} equal intervals. `+Object.entries(d.labels||{}).map(([i,label])=>`Point ${label} is ${i} intervals after 0.`).join(' ')+(d.points||[]).map(i=>`The marked point is ${i} intervals after 0.`).join(' ');
 if(d.type==='figureSet')return 'Nine figures in three rows. Top: orange triangle, orange triangle, orange triangle. Middle: purple rectangle, purple triangle, purple triangle. Bottom: purple triangle, orange rectangle, purple triangle.';
 if(d.type==='modelGroup')return `${d.colored.length} ${d.shape} models, each divided into ${d.parts} equal parts. Colored parts, left to right: ${d.colored.join(', ')}.`;
 if(d.type==='solidRectangle')return 'One blue rectangle.';if(d.type==='counters')return `${d.count} counters, each marked ${d.sign}.`;if(d.type==='pie')return d.title+': '+d.items.map(x=>x.label+' '+x.value+'%').join(', ')+'.';if(d.type==='clock')return 'A clock face numbered 1 through 12, with no hands or shading.';
 if(d.type==='factorTree')return `${d.top} splits into ${d.left} and ${d.right}. Complete the factor tree.`;
 if(d.type==='numberLine')return `Number line from ${d.min} to ${d.max}, marked at every integer.`;
 if(d.type==='venn')return `Venn diagram ${d.leftLabel} and ${d.rightLabel}. Left only: ${d.left.join(', ')}. Shared: ${d.middle.join(', ')}. Right only: ${d.right.join(', ')}.`;
 return '';
}
