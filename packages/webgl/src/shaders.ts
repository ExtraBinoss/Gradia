// Plinka analytic color field: moving radial color sources in a trigonometric
// flow domain. All geometry and weights are evaluated on a fixed GPU mesh.
export const gradientVertex = `
precision highp float;
attribute vec2 a_position;
varying vec3 v_color;
varying float v_height;
uniform float u_time, u_seed, u_scale, u_rotation, u_amplitude, u_frequencyX, u_frequencyY;
uniform float u_blending, u_flow, u_cycles;
uniform vec2 u_pressure, u_center;
uniform float u_stretch, u_twist;
uniform vec3 u_colors[6];
uniform float u_influence[6];
uniform int u_count, u_style;
vec3 palette(float position) {
  float count=float(u_count);
  float at=mod(position,count);
  vec3 result=vec3(0.0);
  float mass=0.0;
  for(int j=0;j<6;j++){if(j<u_count){
    float distance=abs(at-float(j));
    distance=min(distance,count-distance);
    float weight=pow(max(0.0,1.0-distance),max(0.35,1.5-u_blending*0.6));
    weight*=u_influence[j];
    result+=u_colors[j]*weight;
    mass+=weight;
  }}
  return result/max(mass,0.00001);
}
void main() {
  float angle = u_rotation + u_seed * 0.07;
  mat2 turn = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  vec2 p = turn * (a_position - u_center) * 0.5 * u_scale;
  p *= vec2(u_stretch, 1.0 / u_stretch);
  vec2 frequency = vec2(u_frequencyX, u_frequencyY) * 1.7;
  float phase = u_time * u_cycles;
  vec2 wave = vec2(
    sin(p.y * frequency.y + sin(p.x * 2.8 + phase + u_seed) + phase),
    cos(p.x * frequency.x + cos(p.y * 2.4 - phase + u_seed) - phase)
  );
  vec2 domain = p + wave * u_amplitude * 0.065;
  float twist = u_flow * 0.7 * sin(dot(p, p) * 5.0 - phase) + u_twist * dot(p, p);
  domain = mat2(cos(twist), -sin(twist), sin(twist), cos(twist)) * domain;
  domain *= u_pressure * 0.34;
  float sharpness = 3.0 + 24.0 * pow(1.0 - clamp(u_blending / 1.5, 0.0, 1.0), 2.0);
  v_color=vec3(0.0);
  if(u_style==0){
  vec3 sum = vec3(0.0);
  float mass = 0.0;
  for(int i = 0; i < 6; i++) {
    if(i < u_count) {
      float index = float(i);
      float orbit = index * 2.399963 + u_seed * 0.11;
      float radius = 0.25 + 0.35 * index / max(float(u_count - 1), 1.0);
      vec2 center = radius * vec2(
        cos(orbit + sin(phase + index) * 0.6),
        sin(orbit + cos(phase + index * 0.8) * 0.5)
      );
      vec2 delta = domain - center;
      float weight = exp(-dot(delta, delta) * sharpness / max(u_influence[i], 0.05));
      weight *= smoothstep(0.0, 0.08, u_influence[i]);
      sum += u_colors[i] * weight;
      mass += weight;
    }
  }
  v_color = sum / max(mass, 0.00001);

  }
  float count=float(u_count);
  if(u_style==1){
    float folds=domain.y*(2.0+u_frequencyY)+sin(domain.x*3.0+phase)*u_amplitude*0.2;
    float silk=0.5+0.5*sin(folds*3.14159265+cos(domain.x*u_frequencyX+phase));
    v_color=palette(silk*(count-1.0));
    v_height=pow(0.5+0.5*cos(folds*6.2831853),3.0)*u_amplitude*0.1;
  }else if(u_style==2){
    float curtain=sin(domain.x*(3.0+u_frequencyX*2.0)+sin(domain.y*4.0+phase)*u_flow+phase);
    float glow=exp(-pow((domain.y+curtain*0.22)*2.5,2.0));
    v_color=mix(u_colors[0]*0.35,palette((curtain*0.5+0.5)*(count-1.0)),glow);
  }else if(u_style==3){
    vec2 fluid=domain+vec2(sin(domain.y*5.0+phase),cos(domain.x*4.0-phase))*u_flow*0.35;
    float pools=sin(fluid.x*(2.0+u_frequencyX)+sin(fluid.y*(2.0+u_frequencyY)+phase)*u_amplitude*0.25);
    v_color=palette((pools*0.5+0.5)*(count-1.0));
  }else if(u_style==4){
    vec2 orbit=domain-0.15*vec2(sin(phase),cos(phase));
    float rings=length(orbit)*(2.0+u_frequencyX)+0.25*sin(phase)*u_amplitude;
    v_color=palette((0.5+0.5*cos(rings*3.14159265))*(count-1.0));
  }else if(u_style==5){
    float ridge=domain.y*(1.0+u_frequencyY)+sin(domain.x*(2.0+u_frequencyX)+phase)*u_amplitude*0.12;
    v_color=palette((0.5+0.5*sin(ridge*3.14159265))*(count-1.0));
  }
  if(u_style!=1)v_height = (wave.x + wave.y) * u_amplitude * 0.055;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export const gradientFragment = `
precision highp float;
varying vec3 v_color;
varying float v_height;
uniform float u_brightness, u_saturation, u_shadows, u_highlights, u_contrast;
uniform mat3 u_hueRotation;
void main() {
  vec3 c=v_color;
  c*=1.0+max(v_height,0.0)*u_highlights*0.12-min(-min(v_height,0.0),1.0)*u_shadows*0.12;
  c=mix(vec3(dot(c,vec3(0.2126,0.7152,0.0722))),c,u_saturation)*u_brightness;
  c=u_hueRotation*c;
  c=(c-0.5)*u_contrast+0.5;
  gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);
}`;

export const postVertex = `
attribute vec2 a_position;
varying vec2 v_uv;
void main(){v_uv=a_position*0.5+0.5;gl_Position=vec4(a_position,0.0,1.0);}`;

/** Finishing pass after the entire effect stack. Retains composited alpha. */
export const postFragment = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_scene;
uniform vec2 u_resolution;
uniform float u_dpr, u_time, u_grain, u_grainScale, u_vignette, u_chromaticShift;
float hash(vec2 p){vec3 q=fract(vec3(p.x,p.y,p.x+p.y)*vec3(0.1031,0.11369,0.13787));q+=dot(q,q.yzx+19.19);return fract((q.x+q.y)*q.z);}
void main(){
  vec4 sampleColor=texture2D(u_scene,v_uv);
  vec3 c=sampleColor.rgb;
  if(u_chromaticShift>0.0){vec2 shift=(v_uv-0.5)*u_chromaticShift;c.r=texture2D(u_scene,v_uv+shift).r;c.b=texture2D(u_scene,v_uv-shift).b;}
  vec2 grainPx=floor(v_uv*u_resolution/(u_grainScale*u_dpr));
  float n=mix(hash(grainPx),hash(grainPx+vec2(37.0,91.0)),0.5-0.5*cos(u_time*2.0));
  c+=(n-0.5)*u_grain*0.5;
  c*=1.0-smoothstep(0.2,0.8,distance(v_uv,vec2(0.5)))*u_vignette;
  gl_FragColor=vec4(clamp(c,0.0,1.0),sampleColor.a);
}`;
