#version 100
precision highp float;

/** @resolution */
uniform vec2 u_resolution;

/**
 * @label Grid Color
 * @color
 * @default #2a7fff
 */
uniform vec3 u_gridColor;

/**
 * @label Cell Size
 * @default 46
 * @min 14
 * @max 180
 */
uniform float u_cell;

/**
 * @label Strength
 * @default 1.0
 * @min 0.0
 * @max 2.0
 */
uniform float u_strength;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 c = uv - vec2(0.5, 0.42);
  float vig = 1.0 - smoothstep(0.05, 0.9, length(c));

  vec2 p = gl_FragCoord.xy / u_cell;
  vec2 fr = fract(p);
  vec2 d = min(fr, 1.0 - fr);
  float line = min(d.x, d.y);
  float fine = 1.0 - smoothstep(0.0, 0.030, line);

  vec2 p2 = gl_FragCoord.xy / (u_cell * 5.0);
  vec2 fr2 = fract(p2);
  vec2 d2 = min(fr2, 1.0 - fr2);
  float line2 = min(d2.x, d2.y);
  float major = 1.0 - smoothstep(0.0, 0.012, line2);

  float alpha = (fine * 0.30 + major * 0.85) * vig * u_strength;
  gl_FragColor = vec4(u_gridColor, alpha);
}
