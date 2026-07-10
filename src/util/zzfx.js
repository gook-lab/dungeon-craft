// ZzFX — Zuper Zmall Zound Zynth, micro v1.3.2 by Frank Force (MIT licence).
// https://github.com/KilledByAPixel/ZzFX
//
// Vendored as an ES module. The npm package defines browser globals rather
// than exports; this version keeps the proven synth math but creates the
// AudioContext lazily, so importing the file never touches Web Audio until
// the first sound actually plays (safe for tests / non-browser contexts).

const zzfxV = 0.3; // master volume
let _ctx = null;

export function zzfxContext() {
  if (!_ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    _ctx = new Ctor();
  }
  return _ctx;
}

// Play a sound from up to 20 synth parameters. Returns the
// AudioBufferSourceNode (callers track polyphony via its `onended`), or
// null when Web Audio is unavailable.
// eslint-disable-next-line
export function zzfx(p=1,k=.05,b=220,e=0,r=0,t=.1,q=0,D=1,u=0,y=0,v=0,z=0,l=0,E=0,A=0,F=0,c=0,w=1,m=0,B=0,N=0){
  let M=Math,d=2*M.PI,R=44100,G=u*=500*d/R/R,C=b*=(1-k+2*k*M.random(k=[]))*d/R,
  g=0,H=0,a=0,n=1,I=0,J=0,f=0,s=0,h=N<0?-1:1,x=d*h*N*2/R,L=M.cos(x),Z=M.sin,K=Z(x)/4,O=1+K,
  X=-2*L/O,Y=(1-K)/O,P=(1+h*L)/2/O,Q=-(h+L)/O,S=P,T=0,U=0,V=0,W=0;
  e=R*e+9;m*=R;r*=R;t*=R;c*=R;y*=500*d/R**3;A*=d/R;v*=d/R;z*=R;l=R*l|0;p*=zzfxV;
  for(h=e+m+r+t+c|0;a<h;k[a++]=f*p)
    ++J%(100*F|0)||(f=q?1<q?2<q?3<q?4<q?(g/d%1<D/2)*2-1:Z(g**3):M.max(M.min(M.tan(g),1),-1):1-(2*g/d%2+2)%2:1-4*M.abs(M.round(g/d)-g/d):Z(g),
    f=(l?1-B+B*Z(d*a/l):1)*(4<q?s:(f<0?-1:1)*M.abs(f)**D)*(a<e?a/e:a<e+m?1-(a-e)/m*(1-w):a<e+m+r?w:a<h-c?(h-a-c)/t*w:0),
    f=c?f/2+(c>a?0:(a<h-c?1:(h-a)/c)*k[a-c|0]/2/p):f,
    N?f=W=S*T+Q*(T=U)+P*(U=f)-Y*V-X*(V=W):0),
    x=(b+=u+=y)*M.cos(A*H++),g+=x+x*E*Z(a**5),n&&++n>z&&(b+=v,C+=v,n=0),!l||++I%l||(b=C,u=G,n=n||1);

  try {
    const X0 = zzfxContext();
    const buf = X0.createBuffer(1, h, R);
    buf.getChannelData(0).set(k);
    const src = X0.createBufferSource();
    src.buffer = buf;
    src.connect(X0.destination);
    src.start();
    return src;
  } catch {
    return null;
  }
}
