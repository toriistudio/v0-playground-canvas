precision highp float;

varying vec2 vUv;

uniform float iTime;
uniform vec3 iResolution;
uniform float iFrame;
uniform sampler2D iChannel1;
uniform vec3 iChannelResolution[4];
uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;

float hash(in vec2 p) {
  float r = dot(p, vec2(12.1, 31.7)) + dot(p, vec2(299.5, 78.3));
  return fract(sin(r) * 4358.545);
}

vec3 pal(in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}

vec3 color(vec2 p) {
  return pal(
           0.55 + hash(p) * 0.2,
           uPaletteA,
           uPaletteB,
           uPaletteC,
           uPaletteD
         ) *
         1.5;
}

void main() {
  vec2 fragCoord = vec2(vUv.x * iResolution.x, vUv.y * iResolution.y);
  vec2 resolution = max(iResolution.xy, vec2(1.0));

  vec2 v = resolution;
  v = (fragCoord - v * 0.5) / max(v.x, v.y) + vec2(0.2, 0.0);
  vec2 a = vec2(length(v), atan(v.y, v.x));

  const float pi = 3.1416;
  const float k = 14.0;
  const float w = 4.0;
  const float t = 1.0;

  float iVal = floor(a.x * k);
  float channelHeight = max(iChannelResolution[1].y, 1.0);
  float frameValue = iFrame;

  vec2 bufferSampleUV = vec2(
    0.0,
    mod(frameValue - iVal * 4.0, channelHeight) / channelHeight
  );
  float b = texture(iChannel1, bufferSampleUV).r;

  a = vec2(
    (iVal + 0.3 + b * 0.35) * (1.0 / k),
    (floor(a.y * (1.0 / pi) * (iVal * w + t)) + 0.5) * pi / (iVal * w + t)
  );

  vec3 c = color(vec2(iVal, a.y));

  a = vec2(cos(a.y), sin(a.y)) * a.x;

  c *= smoothstep(0.002, 0.0, length(v - a) - 0.02);
  c *= step(0.07, length(v));
  c += vec3(1.0, 1.0, 0.6) *
       smoothstep(0.002, 0.0, length(v) - 0.03 - b * 0.03);

  gl_FragColor = vec4(pow(c, vec3(0.5454)), 1.0);
}
