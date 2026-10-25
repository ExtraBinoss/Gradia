/** Straight RGBA textures; W3C blending followed by Porter–Duff alpha compositing.
 * Mode indices are shared with core's blendModes/compositeModes arrays.
 */
export const compositingGLSL = `
float colorLum(vec3 c){return dot(c,vec3(0.3,0.59,0.11));}
float colorSat(vec3 c){return max(max(c.r,c.g),c.b)-min(min(c.r,c.g),c.b);}
vec3 clipColor(vec3 c){
  float l=colorLum(c),n=min(min(c.r,c.g),c.b),x=max(max(c.r,c.g),c.b);
  if(n<0.0)c=vec3(l)+(c-vec3(l))*l/max(l-n,0.000001);
  if(x>1.0)c=vec3(l)+(c-vec3(l))*(1.0-l)/max(x-l,0.000001);
  return clamp(c,0.0,1.0);
}
vec3 setLum(vec3 c,float l){return clipColor(c+vec3(l-colorLum(c)));}
vec3 setSat(vec3 c,float s){float lo=min(min(c.r,c.g),c.b),hi=max(max(c.r,c.g),c.b);return hi>lo?(c-vec3(lo))*s/(hi-lo):vec3(0.0);}
float colorDodge(float b,float s){if(b<=0.0)return 0.0;if(s>=1.0)return 1.0;return min(1.0,b/(1.0-s));}
float colorBurn(float b,float s){if(b>=1.0)return 1.0;if(s<=0.0)return 0.0;return 1.0-min(1.0,(1.0-b)/s);}
float softLight(float b,float s){float d=b<=0.25?((16.0*b-12.0)*b+4.0)*b:sqrt(b);return s<=0.5?b-(1.0-2.0*s)*b*(1.0-b):b+(2.0*s-1.0)*(d-b);}
float vividLight(float b,float s){return s<0.5?colorBurn(b,2.0*s):colorDodge(b,2.0*s-1.0);}
vec3 blendRGB(vec3 b,vec3 s,int mode){
  if(mode==1)return min(b,s);
  if(mode==2)return b*s;
  if(mode==3)return vec3(colorBurn(b.r,s.r),colorBurn(b.g,s.g),colorBurn(b.b,s.b));
  if(mode==4)return max(b+s-1.0,0.0);
  if(mode==5)return colorLum(s)<colorLum(b)?s:b;
  if(mode==6)return max(b,s);
  if(mode==7)return b+s-b*s;
  if(mode==8)return vec3(colorDodge(b.r,s.r),colorDodge(b.g,s.g),colorDodge(b.b,s.b));
  if(mode==9)return min(b+s,1.0);
  if(mode==10)return colorLum(s)>colorLum(b)?s:b;
  if(mode==11)return mix(2.0*b*s,1.0-2.0*(1.0-b)*(1.0-s),step(vec3(0.5),b));
  if(mode==12)return vec3(softLight(b.r,s.r),softLight(b.g,s.g),softLight(b.b,s.b));
  if(mode==13)return mix(2.0*b*s,1.0-2.0*(1.0-b)*(1.0-s),step(vec3(0.5),s));
  if(mode==14)return vec3(vividLight(b.r,s.r),vividLight(b.g,s.g),vividLight(b.b,s.b));
  if(mode==15)return clamp(b+2.0*s-1.0,0.0,1.0);
  if(mode==16)return mix(min(b,2.0*s),max(b,2.0*s-1.0),step(vec3(0.5),s));
  if(mode==17)return step(vec3(0.5),vec3(vividLight(b.r,s.r),vividLight(b.g,s.g),vividLight(b.b,s.b)));
  if(mode==18)return abs(b-s);
  if(mode==19)return b+s-2.0*b*s;
  if(mode==20)return max(b-s,0.0);
  if(mode==21)return min(b/max(s,vec3(0.000001)),1.0);
  if(mode==22)return setLum(setSat(s,colorSat(b)),colorLum(b));
  if(mode==23)return setLum(setSat(b,colorSat(s)),colorLum(b));
  if(mode==24)return setLum(s,colorLum(b));
  if(mode==25)return setLum(b,colorLum(s));
  return s;
}
vec4 composeRGBA(vec4 backdrop,vec4 source,float opacity,int mode,int operation){
  vec4 b=clamp(backdrop,0.0,1.0),s=clamp(source,0.0,1.0);
  s.a*=clamp(opacity,0.0,1.0);
  vec3 blended=(1.0-b.a)*s.rgb+b.a*blendRGB(b.rgb,s.rgb,mode);
  float fa=1.0,fb=1.0-s.a;
  if(operation==1){fa=1.0-b.a;fb=1.0;}
  else if(operation==2){fa=b.a;fb=0.0;}
  else if(operation==3){fa=0.0;fb=s.a;}
  else if(operation==4){fa=1.0-b.a;fb=0.0;}
  else if(operation==5){fa=0.0;fb=1.0-s.a;}
  else if(operation==6){fa=b.a;fb=1.0-s.a;}
  else if(operation==7){fa=1.0-b.a;fb=s.a;}
  else if(operation==8){fa=1.0-b.a;fb=1.0-s.a;}
  else if(operation==9){fa=1.0;fb=0.0;}
  else if(operation==10){fa=0.0;fb=1.0;}
  else if(operation==11){fa=0.0;fb=0.0;}
  else if(operation==12){fa=1.0;fb=1.0;}
  float alpha=clamp(s.a*fa+b.a*fb,0.0,1.0);
  vec3 premult=s.a*fa*blended+b.a*fb*b.rgb;
  return alpha>0.000001?vec4(clamp(premult/alpha,0.0,1.0),alpha):vec4(0.0);
}`;
