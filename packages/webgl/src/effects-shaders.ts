import { compositingGLSL } from "./compositing";
/** One shader program for the entire effect stack. Each node is a single bounded GPU pass. */
export const effectFragment = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_scene,u_atlas;
uniform vec2 u_resolution;
uniform float u_unit,u_size,u_aspect,u_rotation,u_phase,u_opacity;
uniform vec4 u_p0,u_p1;
uniform vec3 u_foreground,u_background;
uniform int u_type,u_blend,u_composite;
${compositingGLSL}
const float PI=3.141592653589793;
float hash(vec2 p){vec3 q=fract(vec3(p.x,p.y,p.x+p.y)*vec3(0.1031,0.11369,0.13787));q+=dot(q,q.yzx+19.19);return fract((q.x+q.y)*q.z);}
float bayer2(vec2 p){p=mod(floor(p),2.0);return 2.0*p.x+3.0*p.y-4.0*p.x*p.y;}
float bayer4(vec2 p){return (4.0*bayer2(p)+bayer2(floor(p/2.0))+0.5)/16.0;}
float bayer8(vec2 p){return (16.0*bayer2(p)+4.0*bayer2(floor(p/2.0))+bayer2(floor(p/4.0))+0.5)/64.0;}
vec4 readScene(vec2 uv){vec2 edge=0.5/u_resolution;return texture2D(u_scene,clamp(uv,edge,1.0-edge));}
vec4 premult(vec4 c){return vec4(c.rgb*c.a,c.a);}
vec4 straight(vec4 c){return c.a>0.000001?vec4(c.rgb/c.a,c.a):vec4(0.0);}
vec4 mixRGBA(vec4 a,vec4 b,float t){return straight(mix(premult(a),premult(b),t));}
mat2 rotation(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
vec4 asciiEffect(vec2 px){
  vec2 size=max(vec2(1.0),vec2(u_size*0.65,u_size)*u_unit);
  vec2 cell=floor(px/size),center=(cell+0.5)*size/u_resolution;
  vec4 sampleColor=readScene(center);
  float lum=dot(sampleColor.rgb,vec3(0.2126,0.7152,0.0722));
  lum=mix(lum,1.0-lum,u_p0.y);
  float glyph=floor(clamp(lum,0.0,0.9999)*u_p0.w);
  vec2 local=fract(px/size);
  vec2 atlasUV=vec2((glyph+mix(0.0625,0.9375,local.x))/u_p0.w,mix(0.0625,0.9375,local.y));
  float ink=texture2D(u_atlas,atlasUV).r;
  vec3 foreground=mix(u_foreground,min(sampleColor.rgb*1.55+0.12,1.0),u_p0.x);
  float background=(1.0-ink)*u_p0.z,alpha=ink+background;
  vec3 color=(foreground*ink+u_background*background)/max(alpha,0.000001);
  return vec4(color,alpha*sampleColor.a);
}
vec4 ditherEffect(vec2 px){
  float size=max(1.0,u_size*u_unit);
  vec2 p=floor(px/size);
  vec4 sampleColor=readScene((p+0.5)*size/u_resolution);
  vec3 c=sampleColor.rgb;
  if(u_p0.z>0.5)c=vec3(dot(c,vec3(0.2126,0.7152,0.0722)));
  float threshold=bayer4(p);
  if(u_p0.w>0.5)threshold=bayer8(p);
  if(u_p0.w>1.5)threshold=hash(p);
  float levels=u_p0.x-1.0;
  c=clamp(floor(c*levels+0.5+(threshold-0.5)*u_p0.y)/levels,0.0,1.0);
  if(u_p0.z>0.5)c=mix(u_background,u_foreground,c.r);
  return vec4(c,sampleColor.a);
}
vec4 blockSample(vec2 index,vec2 size,mat2 inverse){
  vec2 uv=(inverse*(index*size)+u_resolution*0.5)/u_resolution;
  vec4 color=readScene(uv);
  color.rgb=clamp(color.rgb*(1.0+(hash(index+19.17)-0.5)*u_p1.x),0.0,1.0);
  return color;
}
vec4 blocksEffect(vec2 px){
  vec2 size=max(vec2(2.0),vec2(u_size*u_aspect,u_size)*u_unit);
  mat2 turn=rotation(u_rotation),inverse=rotation(-u_rotation);
  vec2 coord=(turn*(px-u_resolution*0.5))/size;
  vec2 origin=floor(coord),fraction=fract(coord);
  float feather=max(0.0001,u_p0.x*0.5);
  vec2 blend=smoothstep(vec2(0.5-feather),vec2(0.5+feather),fraction);
  vec4 a=mixRGBA(blockSample(origin,size,inverse),blockSample(origin+vec2(1.0,0.0),size,inverse),blend.x);
  vec4 b=mixRGBA(blockSample(origin+vec2(0.0,1.0),size,inverse),blockSample(origin+vec2(1.0),size,inverse),blend.x);
  vec4 color=mixRGBA(a,b,blend.y);
  vec2 local=fract(coord+0.5);
  float bevel=pow(1.0-local.x,10.0)+pow(1.0-local.y,10.0)-pow(local.x,10.0)-pow(local.y,10.0);
  color.rgb=clamp(color.rgb+bevel*u_p0.w*0.35,0.0,1.0);
  if(u_p0.y>0.0||u_p0.z>0.0){
    float halfWidth=0.5-u_p0.y,radius=min(u_p0.z,halfWidth);
    vec2 q=abs(local-0.5)-halfWidth+radius;
    float distance=length(max(q,0.0))+min(max(q.x,q.y),0.0)-radius;
    float aa=0.65/min(size.x,size.y)+u_p0.x*0.06;
    color.a*=1.0-smoothstep(-aa,aa,distance);
  }
  return color;
}
vec4 glassEffect(vec2 px){
  float size=max(2.0,u_size*u_unit);
  mat2 inverse=rotation(-u_rotation);
  vec2 p=rotation(u_rotation)*(px-u_resolution*0.5);
  float local=fract(p.x/size+0.5),normal=sin((local-0.5)*PI);
  vec2 direction=inverse*vec2(1.0,0.0);
  vec2 uv=v_uv+direction*normal*size*u_p0.x*0.28/u_resolution;
  float radius=u_p0.y*size*0.18;
  vec4 color=readScene(uv);
  if(radius>0.01){
    vec2 dx=vec2(radius,0.0)/u_resolution,dy=vec2(0.0,radius)/u_resolution;
    color=straight(premult(color)*0.4+(premult(readScene(uv+dx))+premult(readScene(uv-dx))+premult(readScene(uv+dy))+premult(readScene(uv-dy)))*0.15);
  }
  if(u_p0.z>0.0){
    vec2 split=direction*normal*size*u_p0.z*0.035/u_resolution;
    color.r=readScene(uv+split).r;color.b=readScene(uv-split).b;
  }
  float edge=pow(abs(normal),14.0),shine=pow(max(0.0,1.0-normal*normal),12.0);
  color.rgb+=u_p0.w*(shine*0.1+edge*0.2);
  color.rgb=mix(color.rgb,vec3(1.0),u_p1.x*0.08);
  color.rgb+=(hash(floor(px/max(u_unit,0.001)))-0.5)*u_p1.x*0.14;
  return vec4(clamp(color.rgb,0.0,1.0),color.a);
}
vec4 foldsEffect(vec2 px){
  float size=max(2.0,u_size*u_unit);
  vec2 p=rotation(u_rotation)*(px-u_resolution*0.5);
  vec2 direction=rotation(-u_rotation)*vec2(1.0,0.0);
  float cycle=p.x/size+u_p1.x,angle=cycle*2.0*PI;
  float triangle=1.0-4.0*abs(fract(cycle)-0.5);
  float profile=mix(triangle,-cos(angle),u_p0.y);
  float slope=mix(sign(sin(angle)),sin(angle),u_p0.y);
  vec2 uv=v_uv+direction*profile*size*u_p0.x*0.12/u_resolution;
  vec4 color=readScene(uv);
  float shading=1.0+max(slope,0.0)*u_p0.w*0.38-max(-slope,0.0)*u_p0.z*0.48;
  color.rgb=clamp(color.rgb*shading,0.0,1.0);
  return color;
}
void main(){
  vec2 px=v_uv*u_resolution;
  vec4 backdrop=readScene(v_uv),source=backdrop;
  if(u_type==0)source=asciiEffect(px);
  else if(u_type==1)source=ditherEffect(px);
  else if(u_type==2)source=blocksEffect(px);
  else if(u_type==3)source=glassEffect(px);
  else if(u_type==4)source=foldsEffect(px);
  gl_FragColor=composeRGBA(backdrop,source,u_opacity,u_blend,u_composite);
}`;
