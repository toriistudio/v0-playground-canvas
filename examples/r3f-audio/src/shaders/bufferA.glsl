precision highp float;

varying vec2 vUv;

uniform vec3 iResolution;
uniform float iFrame;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;

vec2 toFragCoord(vec2 uv, vec3 resolution) {
  vec2 coord = vec2(uv.x * resolution.x, uv.y * resolution.y);
  return floor(coord);
}

vec2 toUV(vec2 fragCoord, vec3 resolution) {
  return (fragCoord + 0.5) / resolution.xy;
}

void main() {
  vec3 resolution = vec3(max(iResolution.x, 1.0), max(iResolution.y, 1.0), 1.0);
  vec2 fragCoord = toFragCoord(vUv, resolution);
  fragCoord = clamp(fragCoord, vec2(0.0), resolution.xy - vec2(1.0));

  vec2 sampleUV = toUV(fragCoord, resolution);
  vec4 previousColor = texture(iChannel2, sampleUV);

  float targetRow = mod(iFrame, resolution.y);
  float rowIndex = fragCoord.y;
  if (abs(rowIndex - targetRow) < 0.5) {
    gl_FragColor = texture(iChannel1, vec2(0.0, 0.0));
  } else {
    gl_FragColor = previousColor;
  }
}
