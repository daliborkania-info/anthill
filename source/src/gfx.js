// ===== gfx.js: vykreslování ve WebGL 2 =====
// 1) půda, chodby a obloha v jednom nasvíceném shaderu do HDR bufferu, 2) sprity s mapou normál a stíny,
// 3) bloom, filmové tónování, zrno. Popisky a výběr se kreslí nad tím na 2D plátno.
const cv = document.getElementById('g'), ov = document.getElementById('o'), g = ov.getContext('2d');
const gl = cv.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
if (!gl) throw Error(T.gl2, { cause: 1 });
const HDR = !!gl.getExtension('EXT_color_buffer_float');

// společné: šum a světla (lampa svítí na řez zleva shora, na povrchu ji střídá slunce nebo měsíc)
const LIB = /*glsl*/`
precision highp float;
uniform vec2 R;
uniform vec4 C,U;
uniform vec3 SD,SC,AC;
const vec3 LD=vec3(-.47,-.62,.63),LC=vec3(1.5,1.38,1.2),LA=vec3(.24,.24,.27);
float h1(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec2 h2(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.103,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}
float gd(vec2 i,vec2 f,vec2 o){return dot(h2(i+o)*2.-1.,f-o);}
float gn(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(gd(i,f,vec2(0)),gd(i,f,vec2(1,0)),u.x),mix(gd(i,f,vec2(0,1)),gd(i,f,vec2(1)),u.x),u.y)*.7+.5;}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*gn(p);p=mat2(1.6,1.2,-1.2,1.6)*p+3.1;a*=.5;}return s;}
vec3 lit(vec3 al,vec3 n,float gl,vec3 ld,vec3 lc,vec3 am){
  return al*(am+lc*max(dot(n,ld),0.))+lc*gl*pow(max(dot(n,normalize(ld+vec3(0,0,1))),0.),28.);}
`;

const FS = /*glsl*/`
uniform sampler2D S,T;
out vec4 O;
const vec2 WH=vec2(384,216);
// buněčný šum: vektor k nejbližšímu zrnu a jeho náhodné číslo
vec3 wor(vec2 p){vec2 i=floor(p),f=fract(p),mv=vec2(0);float md=9.,mh=0.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(x,y),r=o+h2(i+o)-f;float d=dot(r,r);if(d<md){md=d;mv=r;mh=h1(i+o+7.);}}
  return vec3(mv,mh);}
float sd(vec2 u){return (textureLod(S,u,0.).r-.5)*12.8;}
vec3 sky(vec2 p){
  float l=U.z,an=6.2832*(U.y-.25),sa=sin(an),ca=cos(an),al=clamp((56.-p.y)/56.,0.,1.),ss=smoothstep(.55,0.,abs(sa));
  vec3 hz=mix(vec3(.01,.016,.04),vec3(.5,.7,.92),l);
  vec3 c=mix(hz,mix(vec3(.003,.005,.016),vec3(.07,.22,.6),l),pow(al,.55));
  float ds=length(p-vec2(192.-170.*ca,52.-46.*sa));
  c+=vec3(1.,.35,.08)*ss*(.9*pow(1.-al,3.)+.6*exp(-ds*.025))*smoothstep(-.35,.1,sa);
  vec2 q=p*1.7;float r=h1(floor(q));
  c+=mix(vec3(.7,.8,1.),vec3(1.,.85,.7),fract(r*77.))*step(.975,r)*smoothstep(.2,0.,length(fract(q)-.5+(h2(floor(q))-.5)*.5))*(1.-l)*(1.-l)*(.5+.5*sin(U.x*(1.+r*3.)+r*90.))*3.*al;
  c+=vec3(.05,.06,.1)*(1.-l)*smoothstep(.45,.8,fbm(p*.04+vec2(0,p.x*.01)))*al;
  c+=SC*(smoothstep(4.1,3.5,ds)*8.+exp(-ds*.2)*.5)*smoothstep(-.2,.05,sa);
  q=(p-vec2(192.+170.*ca,52.+46.*sa))/3.;float dm=dot(q,q),nt=smoothstep(.2,-.1,sa);
  if(dm<1.)c=mix(c,vec3(.95,.97,1.)*(.25+.75*gn(q*2.5+3.))*max(dot(vec3(q,sqrt(1.-dm)),vec3(-.5,-.3,.81)),0.)*2.5,smoothstep(1.,.9,dm)*nt);
  c+=vec3(.2,.25,.4)*exp(-sqrt(dm)*.35)*.25*nt;
  vec2 k=vec2(p.x*.026+U.x*.004,p.y*.09);
  float dn=fbm(k+fbm(k*2.+1.7)*.5),cl=smoothstep(.5,.74,dn)*smoothstep(53.,22.,p.y);
  c=mix(c,mix(AC*.6+SC*.55,AC*.9,smoothstep(.55,.85,dn))+vec3(.9,.25,.05)*ss*.5*(1.-al),cl*.92);
  float x=p.x-C.x*.5,m=38.-13.*fbm(vec2(x*.011,2.))-2.*gn(vec2(x*.09,5.));
  c=mix(c,mix(hz,AC*.5+SC*vec3(.1,.13,.18),.5),smoothstep(-.3,.3,p.y-m));
  x=p.x-C.x*.35;m=45.-8.*fbm(vec2(x*.02,7.));
  c=mix(c,mix(hz,(AC*.5+SC*.25)*vec3(.18,.3,.16),.72),smoothstep(-.3,.3,p.y-m));
  x=p.x-C.x*.2;m=50.5-3.*gn(vec2(x*.06,1.))-2.2*abs(fract(x*.55+gn(vec2(x*.2,3.)))-.5)*(.5+gn(vec2(x*.9,8.)));
  return mix(c,(AC*.5+SC*.2)*vec3(.06,.13,.07),smoothstep(-.15,.15,p.y-m));
}
void main(){
  vec2 F=gl_FragCoord.xy,p=(F-R*.5)*vec2(1,-1)/C.z+C.xy,u=p/WH;
  vec4 st=textureLod(T,u,0.),s=textureLod(S,u,0.);
  // sklon polí kamenů a kořenů z okolních vzorků (texel je půl buňky)
  vec4 tx=textureLod(T,u+vec2(.5,0)/WH,0.)-textureLod(T,u-vec2(.5,0)/WH,0.),ty=textureLod(T,u+vec2(0,.5)/WH,0.)-textureLod(T,u-vec2(0,.5)/WH,0.);
  vec2 dR=vec2(tx.r,ty.r),dG=vec2(tx.g,ty.g);
  float dep=p.y-st.a*255.;
  // vzdálenost od stěny (kladná v hlíně), stěny zdrsněné šumem
  float d=(s.r-.5)*12.8+((fbm(p*1.2)-.5)*.8+(gn(p*4.3)-.5)*.22)*smoothstep(-2.5,.5,dep);
  vec2 e=.6/WH,gr=vec2(sd(u+vec2(e.x,0))-sd(u-vec2(e.x,0)),sd(u+vec2(0,e.y))-sd(u-vec2(0,e.y)));
  gr/=max(length(gr),1e-4);
  float aa=1.2/C.z,sol=smoothstep(-aa,aa,d),ug=smoothstep(-.8,.5,dep);
  vec3 col=vec3(0),al=vec3(0),n=vec3(0,0,1);float gl=0.;
  if(sol>0.||ug>0.){
    // půdní horizonty: humus, hnědozem, rezavý jíl, světlé podloží, šedá hlubina
    float t=dep+10.*(fbm(p*.03+3.)-.5),m1=fbm(p*.22+11.);
    al=mix(vec3(.13,.095,.065),vec3(.33,.21,.12),smoothstep(3.,13.,t));
    al=mix(al,vec3(.43,.27,.14),smoothstep(28.,50.,t));
    al=mix(al,vec3(.52,.41,.28),smoothstep(70.,95.,t));
    al=mix(al,vec3(.33,.29,.26),smoothstep(120.,150.,t));
    al*=(.72+.56*m1)*(.92+.08*sin(t*.9+6.*m1));
    al=mix(al,al*vec3(1.3,.9,.55),smoothstep(.55,.75,fbm(p*.13+40.))*.5*smoothstep(15.,40.,t));
    // hrudky a zrna: dvě měřítka, každé zrno je vypouklé a má svůj odstín
    vec3 w1=wor(p*1.15+vec2(gn(p*.8),gn(p*.8+31.))*.9),w2=wor(p*3.1+5.);
    float r1=dot(w1.xy,w1.xy),r2=dot(w2.xy,w2.xy),f1=smoothstep(1.2,3.5,C.z),f2=smoothstep(3.,9.,C.z),f3=smoothstep(8.,22.,C.z);
    n.xy-=w1.xy*.8*smoothstep(.55,0.,r1)*f1+w2.xy*.45*f2+(vec2(gn(p*11.),gn(p*11.+17.))-.5)*.5*f3;
    al*=mix(1.,(.78+.44*w1.z)*(1.-.4*smoothstep(.18,.5,r1)),f1)*mix(1.,.88+.24*w2.z,f2)*(1.+(gn(p*8.3)-.5)*.3*f3);
    float sg=smoothstep(.1,.04,r2)*f2;
    al=mix(al,mix(vec3(.72,.66,.55),vec3(.5,.42,.33),fract(w2.z*61.)),step(.975,w2.z)*.5*sg);
    if(f3>0.){vec3 w4=wor(p*8.7+vec2(gn(p*3.),gn(p*3.+9.))*2.);n.xy-=w4.xy*.55*f3;al*=mix(1.,(.8+.4*w4.z)*(1.-.35*smoothstep(.1,.45,dot(w4.xy,w4.xy))),f3);}
    al=mix(al,vec3(.05,.035,.025),step(w2.z,.03)*smoothstep(22.,2.,t)*.5*sg);
    // oblázky: přibývají s hloubkou
    vec3 w3=wor(p*vec2(.42,.6)+gn(p*.3)*.6);
    float pr=.12+.2*fract(w3.z*7.3),pd=length(w3.xy),pk=step(.93-.13*smoothstep(35.,110.,t),w3.z)*smoothstep(pr,pr-.04,pd)*sol;
    vec3 pc=mix(mix(vec3(.5,.49,.47),vec3(.62,.52,.38),step(.5,fract(w3.z*13.))),vec3(.82,.8,.76),step(.8,fract(w3.z*29.)));
    al=mix(al,pc*(.8+.3*gn(p*6.)),pk);n=mix(n,vec3(-w3.xy/pr,sqrt(max(1.-pd*pd/(pr*pr),0.))*1.3),pk);gl=.35*pk;
    // kořeny jako oblé provazce
    float rd=(st.g-.5)*4.,rm=smoothstep(-aa,aa,rd),rq=clamp(rd/.6,0.,1.);
    vec2 rg=dG*4.;
    al*=1.-.45*smoothstep(-.55,0.,rd)*(1.-rm);
    al=mix(al,mix(vec3(.22,.14,.08),vec3(.5,.36,.21),gn(vec2(rd*7.,dot(p,vec2(.3,.2)))+gn(p*.7)*2.))*(.8+.4*gn(p*5.)),rm);
    n=mix(n,vec3(-rg*(1.-rq)*1.3+n.xy*.35,.35+rq),rm);gl=mix(gl,.12,rm);
    // kameny: oblý tvar ze vzdálenosti od okraje, žilky a zrnitost
    float sm=smoothstep(-aa,aa,4.5*(st.r-.13)+(m1-.5)*.25),v=gn(p*.07+70.);
    vec3 sc=mix(mix(vec3(.47,.46,.45),vec3(.56,.48,.38),smoothstep(.45,.6,v)),vec3(.3,.31,.34),smoothstep(.5,.35,v));
    sc*=(.75+.5*fbm(p*.9+50.))*(1.+(gn(p*7.)-.5)*.5*f2);
    sc=mix(sc,vec3(.8,.78,.74),smoothstep(.012,0.,abs(gn(p*.22+30.)-.5))*.45);
    al=mix(al,mix(al,sc,smoothstep(.1,.3,st.r)*.6+.4),sm);
    n=mix(n,vec3(-dR*9.*(1.-st.r)*(1.-st.r)+(vec2(gn(p*2.3+1.),gn(p*2.3+9.))-.5)*.6,1),sm);gl=mix(gl,.3,sm);
    // vynesená hlína na valu: sypká, světlejší
    float mo=smoothstep(.6,-.6,dep);
    al=mix(al,vec3(.4,.285,.17)*(.7+.5*w1.z)*(.85+.3*w2.z),mo);
    // drn: tmavá vrstva s mechem těsně pod povrchem
    al=mix(al,vec3(.1,.16,.05)*(.7+.6*w2.z),step(sd(u-vec2(0,2.2)/WH),0.)*smoothstep(2.2,.2,dep)*(1.-mo)*.85);
    al=pow(al,vec3(2.2));
  }
  if(sol<1.){
    vec3 a=vec3(0);
    if(ug<1.){
      a=sky(p);
      // rozostřená louka těsně nad zemí
      a=mix(a,(AC*.6+SC*.3)*vec3(.12,.24,.06)*(.5+fbm(vec2(p.x*.6,p.y*.2))),smoothstep(-8.,-.5,dep)*.9);
    }
    if(ug>0.){
      // chodba jako vyhloubený žlab: u stěny se zadní strana zvedá k divákovi, strop je ve stínu
      float q=clamp(-d/1.7,0.,1.),zc=sqrt(1.-(1.-q)*(1.-q)),wd=textureLod(S,u,3.).g;
      vec3 nc=normalize(vec3(-gr*(1.-q)*1.7+n.xy*.3,zc+.15));
      float sh=(1.-.6*smoothstep(-.6,.5,sd(u+LD.xy*1.3/WH))*zc)*(1.-.3*smoothstep(-.6,.5,sd(u+LD.xy*2.8/WH))*zc);
      float ao=mix(.3,1.,q)*mix(.55,1.,1.-wd);
      vec3 ac=mix(al,pow(vec3(.5,.37,.23),vec3(2.2)),.45);
      vec3 cc=ac*(LA*ao+LC*max(dot(nc,LD),0.)*sh*ao)*mix(1.,.8,zc)*(.5+.5*smoothstep(0.,.35,-d));
      cc+=ac*(AC+SC*.4)*s.a*s.a*1.2;
      a=mix(a,cc,ug);
    }
    col=a;
  }
  if(sol>0.){
    float es=1.-smoothstep(-1.,7.,dep),bv=smoothstep(.7,0.,d);
    n.xy-=gr*bv*1.1;
    vec3 cs=lit(al,normalize(n),gl,normalize(mix(LD,SD,es)),mix(LC,SC,es),mix(LA,AC,es));
    cs*=1.-.25*bv;
    cs+=vec3(1.,.5,.1)*s.b*C.w*(.12+.06*sin(U.x*3.+p.x*.7+p.y*.7));
    col=mix(col,cs,sol);
  }
  O=vec4(col,1);
}`;

const SV = /*glsl*/`
layout(location=0) in vec4 a0;
layout(location=1) in vec4 a1;
layout(location=2) in vec4 a2;
layout(location=3) in vec4 a3;
layout(location=4) in vec4 a4;
layout(location=5) in float a5;
out vec2 v;
out vec4 t,b;
out vec3 m;
void main(){
  vec2 q=vec2(gl_VertexID&1,gl_VertexID>>1),l=mix(a3.xy,a3.zw,q),w=a0.xy+a0.zw*l.x+a1.xy*l.y;
  v=mix(a2.xy,a2.zw,q);t=a4;b=vec4(normalize(a0.zw),normalize(a1.xy));m=vec3(a1.zw,a5);
  gl_Position=vec4((w-C.xy)*C.z/(R*.5)*vec2(1,-1),0,1);
}`;
const SF = /*glsl*/`
uniform sampler2D A,N;
in vec2 v;
in vec4 t,b;
in vec3 m;
out vec4 O;
void main(){
  vec4 c=texture(A,v),nm=texture(N,v);
  if(m.y>.5&&m.y<1.5){O=vec4(0,0,0,textureLod(A,v,4.).a*t.a);return;}
  if(c.a<.004)discard;
  if(m.y>1.5){O=vec4(c.rgb*t.rgb*t.a,0);return;}
  vec3 al=mix(pow(c.rgb/c.a,vec3(2.2)),vec3(.3,.17,.07),m.z)*t.rgb;
  vec3 n=nm.xyz*2.-1.;
  n=normalize(vec3(n.x*b.xy+n.y*b.zw,n.z));
  vec3 ld=normalize(mix(LD,SD,m.x)),lc=mix(LC,SC,m.x);
  vec3 col=lit(al,n,nm.a*.7,ld,lc,mix(LA,AC,m.x))+lc*al*pow(1.-n.z,3.)*nm.a*.5;
  O=vec4(col*c.a*t.a,c.a*t.a);
}`;
const PF = /*glsl*/`
uniform sampler2D X;
out vec4 O;
void main(){
  vec2 u=gl_FragCoord.xy/R;
  vec3 c=texture(X,u).rgb,b=textureLod(X,u,2.5).rgb*.4+textureLod(X,u,4.).rgb*.35+textureLod(X,u,5.5).rgb*.25;
  c+=max(b-.75,0.)*.7+b*.04;
  u-=.5;c*=1.-.75*dot(u,u);
  c*=1.15;c=c*(2.51*c+.03)/(c*(2.43*c+.59)+.14);
  O=vec4(pow(clamp(c,0.,1.),vec3(.4545))+(h1(gl_FragCoord.xy+fract(U.x)*91.)-.5)*.02,1);
}`;
const QV = 'void main(){gl_Position=vec4(vec2(gl_VertexID%2,gl_VertexID/2)*4.-1.,0,1);}';

const W2 = W * 2, H2 = H * 2, MAXI = 9000, I = new Float32Array(MAXI * 21), UL = new Map();
let PT, PS, PP, vaoQ, vaoS, fbo, sw = 0, sh = 0, rsc = 1, ema = 16, tAdj = 0, ni = 0;
function prog(vs, fs) {
  const p = gl.createProgram();
  for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const o = gl.createShader(t); gl.shaderSource(o, '#version 300 es\n' + s); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(o));
    gl.attachShader(p, o);
  }
  gl.linkProgram(p); gl.useProgram(p);
  const m = {}; for (const n of ['R', 'C', 'U', 'SD', 'SC', 'AC']) m[n] = gl.getUniformLocation(p, n);
  UL.set(p, m);
  ['S', 'T', 'A', 'N', 'X'].forEach((n, i) => gl.uniform1i(gl.getUniformLocation(p, n), i));
  return p;
}
const texUnit = (unit, min) => {
  gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
};
// dvouprůchodová vzdálenostní transformace na místě (hodnoty: 0 u zdroje, jinak velké číslo)
function chamfer(d, w, h) {
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; d[i] = Math.min(d[i], d[i - 1] + 1, d[i - w] + 1, d[i - w - 1] + 1.414, d[i - w + 1] + 1.414); }
  for (let y = h - 2; y > 0; y--) for (let x = w - 2; x > 0; x--) { const i = y * w + x; d[i] = Math.min(d[i], d[i + 1] + 1, d[i + w] + 1, d[i + w + 1] + 1.414, d[i + w - 1] + 1.414); }
}
const di = new Float32Array(N), dq = new Float32Array(N);
function buildTex() { // R vzdálenost od stěny, G hlína, B plán stavby, A denní světlo od vchodu
  for (let i = 0; i < N; i++) if (solid[i]) { di[i] = 99; dq[i] = 0; } else { di[i] = 0; dq[i] = 99; }
  chamfer(di, W, H); chamfer(dq, W, H);
  for (let i = 0; i < N; i++) di[i] = solid[i] ? di[i] - .5 : .5 - dq[i];
  for (let k = 0; k < 2; k++) { // lehké vyhlazení, ať stěny a val nemají schody
    for (let i = 0; i < N; i++) dq[i] = i % W && (i + 1) % W ? (di[i - 1] + 2 * di[i] + di[i + 1]) / 4 : di[i];
    for (let i = 0; i < N; i++) di[i] = i < W || i >= N - W ? dq[i] : (dq[i - W] + 2 * dq[i] + dq[i + W]) / 4;
  }
  for (let i = 0, j = 0; i < N; i++, j += 4) {
    tex[j] = clamp(128 + di[i] * 20, 0, 255); tex[j + 1] = solid[i] ? 255 : 0; tex[j + 2] = plan[i] ? 255 : 0;
    tex[j + 3] = dug[i] ? Math.max(0, 255 - fx[i] * 7) : solid[i] ? 0 : 255;
  }
}
function setupGL() {
  PT = prog(QV, LIB + FS); PS = prog(LIB + SV, LIB + SF); PP = prog(QV, LIB + PF);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  // neměnná textura ve dvojnásobném rozlišení: R kameny, G kořeny, A původní povrch
  const t1 = new Uint8Array(W2 * H2 * 4), ds = new Float32Array(W2 * H2);
  const tm = new Float32Array(W2 * H2);
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) ds[y * W2 + x] = solid[(y >> 1) * W + (x >> 1)] == 2 ? 1 : 0;
  for (let k = 0; k < 4; k++) { // obrys kamenů se zaoblí rozmazáním a prahem
    const a = k & 1 ? tm : ds, o = k & 1 ? ds : tm, st = k < 2 ? 1 : W2;
    for (let i = 3 * W2; i < W2 * H2 - 3 * W2; i++) o[i] = (a[i - 3 * st] + a[i - 2 * st] + a[i - st] + a[i] + a[i + st] + a[i + 2 * st] + a[i + 3 * st]) / 7;
  }
  for (let i = 0; i < W2 * H2; i++) ds[i] = ds[i] > .5 ? 99 : 0;
  chamfer(ds, W2, H2);
  for (let k = 0; k < roots.length; k += 3) {
    const nx = roots[k + 3], ny = roots[k + 4], near = Math.hypot(nx - roots[k], ny - roots[k + 1]) < 1;
    for (let q = 0; q < (near ? 3 : 1); q++) { // mezi sousedními body kořene se doplní mezikroky, ať je provazec souvislý
      const x = (roots[k] + (nx - roots[k]) * q / 3) * 2, y = (roots[k + 1] + (ny - roots[k + 1]) * q / 3) * 2, r = (.22 + (roots[k + 2] - q / 3) * .026) * 2, e = r + 4.5;
      for (let py = Math.max(0, y - e | 0); py <= Math.min(H2 - 1, y + e); py++) for (let px = Math.max(0, x - e | 0); px <= Math.min(W2 - 1, x + e); px++) {
        const j = (py * W2 + px) * 4 + 1; t1[j] = Math.max(t1[j], clamp(127.5 + (r - Math.hypot(px + .5 - x, py + .5 - y)) * 32, 0, 255));
      }
    }
  }
  for (let i = 0; i < W2 * H2; i++) { t1[i * 4] = Math.min(255, ds[i] / 9 * 255); t1[i * 4 + 3] = base[(i % W2) >> 1]; }
  texUnit(1, gl.LINEAR); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W2, H2, 0, gl.RGBA, gl.UNSIGNED_BYTE, t1);
  texUnit(2, gl.LINEAR_MIPMAP_LINEAR); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, AS, AS, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(alb.buffer)); gl.generateMipmap(gl.TEXTURE_2D);
  texUnit(3, gl.LINEAR_MIPMAP_LINEAR); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, AS, AS, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(nrm.buffer)); gl.generateMipmap(gl.TEXTURE_2D);
  texUnit(0, gl.LINEAR_MIPMAP_LINEAR); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  texUnit(4, gl.LINEAR_MIPMAP_LINEAR);
  fbo = gl.createFramebuffer();
  vaoQ = gl.createVertexArray();
  vaoS = gl.createVertexArray(); gl.bindVertexArray(vaoS);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, I.byteLength, gl.DYNAMIC_DRAW);
  for (let i = 0; i < 6; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, i < 5 ? 4 : 1, gl.FLOAT, false, 84, i * 16); gl.vertexAttribDivisor(i, 1); }
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

// --- kamera ---
const cam = { x: W / 2, y: H / 2, s: 1 };
let cw = 0, ch = 0, minS = 1, dpr = 1;
function clampCam() {
  cam.s = clamp(cam.s, minS, minS * 14);
  const hw = cw / 2 / cam.s, hh = ch / 2 / cam.s;
  cam.x = clamp(cam.x, hw, W - hw); cam.y = clamp(cam.y, hh, H - hh);
}
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  const w = innerWidth * dpr | 0, h = innerHeight * dpr | 0;
  if (w == cw && h == ch) return;
  const z = cam.s / minS;
  cw = cv.width = ov.width = w; ch = cv.height = ov.height = h;
  minS = Math.max(cw / W, ch / H); cam.s = minS * z; clampCam();
}

// --- okrasa mimo simulaci: žížaly, trsy trávy navíc, motýli, drobky při kopání ---
const worms = [], deco = [], crumbs = [];
for (let i = 0; i < 5; i++) {
  let x, y; do { x = 8 + br() * (W - 16); y = 70 + br() * (H - 80); } while (solid[(y | 0) * W + (x | 0)] != 1);
  const a = br() * 6.28, b = []; for (let k = 0; k < 22; k++) b.push([x - Math.cos(a) * k * .3, y - Math.sin(a) * k * .3]);
  worms.push({ a, p: br() * 9, b });
}
for (let i = 0; i < 300; i++) deco.push({ x: br() * W, v: br() * 8 | 0, h: bq(.55, 1.6), p: br() * 6.28, f: br() < .22, m: br() < .5 ? 1 : -1 });
Object.assign(queen, { a: 0, nx: 0, ny: -1, sd: 1, st: 0, ph: 0, age: 999, cr: 0 });

function put(s, x, y, Xx, Xy, Yx, Yy, r, gg, b, a, env, mode, pale) {
  if (ni >= MAXI) return;
  const q = SP[s], o = ni++ * 21;
  I[o] = x; I[o + 1] = y; I[o + 2] = Xx; I[o + 3] = Xy; I[o + 4] = Yx; I[o + 5] = Yy; I[o + 6] = env; I[o + 7] = mode;
  I[o + 8] = q[0]; I[o + 9] = q[1]; I[o + 10] = q[2]; I[o + 11] = q[3]; I[o + 12] = q[4]; I[o + 13] = q[5]; I[o + 14] = q[6]; I[o + 15] = q[7];
  I[o + 16] = r; I[o + 17] = gg; I[o + 18] = b; I[o + 19] = a; I[o + 20] = pale || 0;
}
// otočený sprite v jednotné barvě; mode 1 = jen měkký stín
const rot = (s, x, y, a, k, env, mode, al) => { const c = Math.cos(a) * k, n = Math.sin(a) * k; put(s, x, y, c, n, -n, c, 1, 1, 1, al, env, mode); };
function antSprite(a, sc, s0, t, shadow) {
  const cs = Math.cos(a.a), sn = Math.sin(a.a), v = sn * a.nx - cs * a.ny;
  if (v > .25) a.sd = 1; else if (v < -.25) a.sd = -1;
  const k = AL * sc, bob = a.st == 2 ? Math.sin(t * 22) * .09 : 0, x = a.x + cs * bob, y = a.y + sn * bob;
  if (shadow) { put(s0, x + .2 * sc, y + .26 * sc, k * cs, k * sn, -k * sn * a.sd, k * cs * a.sd, 0, 0, 0, .5, 0, 1); return; }
  put(s0, x, y, k * cs, k * sn, -k * sn * a.sd, k * cs * a.sd, 1, 1, 1, 1, a.m ? 1 : 0, 0, clamp(1 - a.age / 60, 0, 1) * .75);
  if (a.cr) rot(a.cr == 1 ? S_PELLET : a.cr == 2 ? S_SEED + a.cc : a.ci ? S_EGG + a.ci.t - 1 : S_EGG, x + cs * k * .5, y + sn * k * .5, a.a, 1, a.m ? 1 : 0, 0, 1);
}
const antFrame = (a, t) => S_ANT + (a.tm > 0 ? 12 + (t * 1.5 + a.id & 1) : ((a.ph * 6.1 | 0) % 12 + 12) % 12);

function render(t, rdt) {
  // rozlišení se přizpůsobuje výkonu
  if (rdt && rdt < .09) ema += (rdt * 1e3 - ema) * .05; // delší prodleva znamená skrytou záložku, ne pomalé kreslení
  if (t - tAdj > 1.5 && ema > 30 && rsc > .5) { rsc -= .1; ema = 20; tAdj = t; } else if (t - tAdj > 6 && ema < 19 && rsc < 1) { rsc = Math.min(1, rsc + .1); tAdj = t; }
  const w = Math.max(2, cw * rsc | 0), h = Math.max(2, ch * rsc | 0);
  if (w != sw || h != sh) {
    sw = w; sh = h;
    gl.activeTexture(gl.TEXTURE4); gl.texImage2D(gl.TEXTURE_2D, 0, HDR ? gl.RGBA16F : gl.RGBA8, sw, sh, 0, gl.RGBA, HDR ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, gl.getParameter(gl.TEXTURE_BINDING_2D), 0);
  }
  if (texDirty) { texDirty = 0; buildTex(); gl.activeTexture(gl.TEXTURE0); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, tex); gl.generateMipmap(gl.TEXTURE_2D); }

  // slunce, měsíc a světlo oblohy
  const an = 6.2832 * (ph - .25), sa = Math.sin(an), ca = Math.cos(an), day = sstep(-.08, .12, sa), warm = sstep(0, .45, sa), dusk = sstep(.55, 0, Math.abs(sa));
  const sd = sa > -.06 ? [-ca * .8, -Math.max(sa, .1) * .9 - .1, .55] : [ca * .8, -Math.max(-sa, .1) * .9 - .1, .55], sl = Math.hypot(...sd);
  const sc = sa > -.06 ? [2.6 * day, (1.1 + 1.3 * warm) * day, (.35 + 1.75 * warm) * day] : [.1 * (1 - L), .13 * (1 - L), .22 * (1 - L)];
  const ac = [.022 + .3 * L + .12 * dusk * L, .032 + .4 * L, .065 + .5 * L];
  const S = cam.s, uni = (p, rw, rh, scale) => {
    gl.useProgram(p); const u = UL.get(p);
    gl.uniform2f(u.R, rw, rh); gl.uniform4f(u.C, cam.x, cam.y, S * scale, showPlan); gl.uniform4f(u.U, t % 1000, ph, L, 0);
    gl.uniform3f(u.SD, sd[0] / sl, sd[1] / sl, sd[2] / sl); gl.uniform3fv(u.SC, sc); gl.uniform3fv(u.AC, ac);
  };
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, sw, sh); gl.disable(gl.BLEND);
  uni(PT, sw, sh, rsc); gl.bindVertexArray(vaoQ); gl.drawArrays(gl.TRIANGLES, 0, 3);

  // --- sprity, odzadu dopředu ---
  const x0 = cam.x - cw / 2 / S - 6, x1 = cam.x + cw / 2 / S + 6, y0 = cam.y - ch / 2 / S - 6, y1 = cam.y + ch / 2 / S + 6;
  const inv = a => a.x > x0 && a.x < x1 && a.y > y0 && a.y < y1, sky0 = y0 < 70;
  ni = 0;
  for (const wm of worms) { // žížaly lezou hlínou
    const hd = wm.b[0], sp = rdt * .9;
    wm.a += Math.sin(t * .9 + wm.p) * rdt * 1.3;
    const fx2 = hd[0] + Math.cos(wm.a) * 2.5 | 0, fy2 = hd[1] + Math.sin(wm.a) * 2.5 | 0;
    if (fx2 < 4 || fx2 > W - 5 || fy2 > H - 5 || fy2 < base[clamp(fx2, 0, W - 1)] + 5 || solid[fy2 * W + fx2] != 1) wm.a += 11 * rdt; else { hd[0] += Math.cos(wm.a) * sp; hd[1] += Math.sin(wm.a) * sp; }
    for (let i = 1; i < wm.b.length; i++) { const q = wm.b[i], p = wm.b[i - 1], dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy) || 1; if (d > .3) { q[0] = p[0] + dx / d * .3; q[1] = p[1] + dy / d * .3; } }
    if (hd[0] > x0 - 8 && hd[0] < x1 + 8 && hd[1] > y0 - 8 && hd[1] < y1 + 8) for (let i = wm.b.length - 1; i >= 0; i--) {
      const q = wm.b[i], p = wm.b[Math.max(i - 1, 0)];
      rot(S_WORM, q[0], q[1], Math.atan2(q[1] - p[1], q[0] - p[0]), (i > 4 && i < 9 ? 1.12 : i > 18 ? .8 : 1) * .8, 0, 0, 1);
    }
  }
  for (let ps = 1; ps >= 0; ps--) for (const r of rooms) if (r.done && r.x > x0 - 16 && r.x < x1 + 16) for (const s of r.slots) { // zásoby a plod, nejdřív stíny
    const it = s.it; if (!it) continue;
    const x = s.x + .5 + s.jx, y = s.y + (s.l ? .78 : .66), sp = it.t ? S_EGG + it.t - 1 : S_SEED + it.k;
    if (ps) rot(sp, x + .1, y + .13, s.jx * 9, 1, 0, 1, .45); else rot(sp, x, y, s.jx * 9, 1, 0, 0, 1);
  }
  const plant = front => {
    if (!sky0) return;
    for (const p of deco) if (p.f == front && p.x > x0 && p.x < x1 && base[p.x | 0] - top[p.x | 0] < 3) {
      const k = p.v > 5 ? p.h * 1.3 : p.h * (front ? .45 : .9), sw2 = Math.sin(t * 1.4 + p.p + p.x * .15) * .07 * k;
      put(p.v > 5 ? S_CLOVER + p.v - 6 : S_TUFT + p.v, p.x, gy(p.x) + (p.v > 5 ? .2 : .35 * k), k * p.m, 0, -sw2, k, 1, 1, 1, 1, 1, 0);
    }
    for (const p of plants) if ((p.c > .8) == front && p.x > x0 && p.x < x1) {
      const m = p.p > 3.14 ? 1 : -1;
      const s = p.k == 0 ? S_TUFT + (p.c * 12 | 0) % 6 : p.k == 1 ? S_FLOWER + (p.p * 9 | 0) % 5 : p.k == 2 ? S_TALL + (p.c * 8 & 1) : S_MUSH + (p.c * 8 & 1);
      const k = p.k == 0 ? p.h * (front ? .25 : .4) : p.k == 1 ? p.h * .36 : p.k == 2 ? p.h * .3 : p.h * 1.3, sw2 = p.k == 3 ? 0 : Math.sin(t * 1.2 + p.p + p.x * .15) * (p.k == 0 ? .07 : .045) * k;
      put(s, p.x, gy(p.x) + (p.k ? .25 : .35 * k), k * m, 0, -sw2, k, 1, 1, 1, 1, 1, 0);
    }
  };
  plant(false);
  for (const f of foods) if (f.u > 0 && f.x > x0 && f.x < x1) { // potrava na povrchu
    const y = gy(f.x) + .1, q = Math.sqrt(f.u / f.u0);
    if (f.k == 0) for (let i = 0; i < f.u && i < 12; i++) rot(S_SEED, f.x + ((i * 7.3 + f.r * 9) % 3 - 1.5) * .7, y - .25 - (i % 3) * .3, i * 2.1, 1.25, 1, 0, 1);
    else rot(f.k == 1 ? S_BERRY : f.k == 2 ? S_BEETLE : S_CRUMB, f.x, y, f.k == 2 ? (f.r - .5) * .3 : 0, f.k == 1 ? .5 + .6 * q : f.k == 2 ? .6 + .5 * q : .45 + .6 * q, 1, 0, 1);
  }
  for (const d of drops) rot(S_CRUMB, d.x, d.y + 1, d.y * .3, .8, 1, 0, 1);
  for (let k = 0; k < ev.length; k += 2) if (crumbs.length < 80) for (let i = 0; i < 2; i++) crumbs.push({ x: ev[k], y: ev[k + 1], vx: (br() - .5) * 2.5, vy: -br() * 2, t: 1 });
  ev.length = 0;
  for (let i = crumbs.length - 1; i >= 0; i--) { // drobky hlíny při kopání
    const c = crumbs[i], nx = c.x + c.vx * rdt, ny = c.y + c.vy * rdt;
    c.vy += 22 * rdt; c.t -= rdt * .8;
    if (solid[(ny | 0) * W + (nx | 0)]) { c.vx = 0; c.vy = 0; c.t -= rdt * 1.5; } else { c.x = nx; c.y = ny; }
    if (c.t <= 0) { crumbs.splice(i, 1); continue; }
    rot(S_PELLET, c.x, c.y, i, .45, 0, 0, Math.min(1, c.t * 2));
  }
  for (const a of ants) if (!a.m && inv(a)) antSprite(a, 1, antFrame(a, t), t, 1);
  if (queen.room) { queen.a = Math.sin(t * .35) * .06; const f = S_QUEEN + (t * .7 & 1); antSprite(queen, 2.2, f, t, 1); antSprite(queen, 2.2, f, t); }
  for (const a of ants) if (inv(a)) antSprite(a, 1, antFrame(a, t), t);
  for (let i = dead.length - 1; i >= 0; i--) { const d = dead[i]; if ((d.t -= rdt * .3) <= 0) { dead.splice(i, 1); continue; } rot(S_ANT + 12, d.x, d.y, d.a, AL, 0, 0, d.t); }
  plant(true);
  if (sky0) {
    for (let i = 0; i < 3; i++) { // motýli za dne
      const x = (i * 131 + 60 + Math.sin(t * .23 + i * 2) * 40 + t * 2) % W, y = gy(x) - 9 - Math.sin(t * .7 + i * 1.3) * 4 - i * 3, fl = Math.abs(Math.sin(t * 13 + i)) * .9 + .1, c = [[1, .55, .12], [.95, .95, .9], [.5, .65, 1]][i];
      for (const m of [1, -1]) put(S_WING, x, y, 1.6 * fl * m, .5 * (1 - fl), 0, 1.6, c[0], c[1], c[2], sstep(.3, .6, L), 1, 0);
    }
    for (let i = 0; i < 46; i++) { // pyl ve slunci, světlušky za tmy
      const day2 = i < 28, x = day2 ? (i * 37.7 + t * (.5 + i % 5 * .25)) % W : (i * 71.3 + 20) % W + Math.sin(t * .4 + i) * 6;
      const y = day2 ? gy(x) - 3 - i * 13.3 % 26 + Math.sin(t * .5 + i) * 1.5 : gy(x) - 3 - (Math.sin(t * .6 + i * 2.1) + 1) * 4 - i % 5;
      const al = day2 ? L * .5 : (1 - L) * Math.max(0, Math.sin(t * 2 + i * 1.7)) * 9, k = day2 ? .22 : .5;
      if (al > .01) put(S_GLOW, x, y + k, k, 0, 0, k, day2 ? 1 : .7, 1, day2 ? .8 : .3, al, 1, 2);
    }
  }
  if (ni) {
    gl.enable(gl.BLEND); uni(PS, sw, sh, rsc); gl.bindVertexArray(vaoS);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, I, 0, ni * 21); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, ni);
  }
  // --- závěrečný průchod na obrazovku ---
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cw, ch); gl.disable(gl.BLEND);
  gl.activeTexture(gl.TEXTURE4); gl.generateMipmap(gl.TEXTURE_2D);
  uni(PP, cw, ch, 1); gl.bindVertexArray(vaoQ); gl.drawArrays(gl.TRIANGLES, 0, 3);

  // --- 2D vrstva: výběr a popisky komor ---
  const ox = cw / 2 - cam.x * S, oy = ch / 2 - cam.y * S;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cw, ch);
  if (follow) {
    g.setTransform(S, 0, 0, S, ox, oy); g.strokeStyle = 'rgba(255,232,170,.9)'; g.lineWidth = 1.5 / S * dpr; g.setLineDash([.6, .5]);
    g.beginPath(); g.arc(follow.x, follow.y, follow == queen ? 4 : 2.2, t, t + 6.3); g.stroke(); g.setLineDash([]); g.setTransform(1, 0, 0, 1, 0, 0);
  }
  if (showLab) {
    g.font = `600 ${clamp(1.5 * S, 10 * dpr, 17 * dpr) | 0}px system-ui,sans-serif`; g.textAlign = 'center'; g.lineWidth = 3 * dpr; g.lineJoin = 'round';
    for (const r of rooms) if (r.type != SHAFT && r.x > x0 && r.x < x1) {
      const s = T.names[r.type] + (r.done ? '' : ' · ' + fmt(T.dig, { n: 100 - 100 * r.left / r.tot | 0 })), x = r.x * S + ox, y = (r.y - r.ry - 1.2) * S + oy;
      g.strokeStyle = 'rgba(22,11,4,.6)'; g.strokeText(s, x, y); g.fillStyle = r.done ? 'rgba(255,240,210,.92)' : 'rgba(255,196,110,.9)'; g.fillText(s, x, y);
    }
  }
}
