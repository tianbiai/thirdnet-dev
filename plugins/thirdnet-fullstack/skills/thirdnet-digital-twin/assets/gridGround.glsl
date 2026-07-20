// gridGround.glsl — UV-adapted derivative of ../../grid.glsl (source of truth).
// Why adapted: the original uses gl_FragCoord/u_resolution (screen pixel space),
// which would "swim" across a 3D ground plane as the camera moves. This version
// drives the same grid recipe (fine grid + every-5th major grid + radial vignette)
// from the plane's vUv so it tracks the ground correctly. Uniforms u_gridColor /
// u_cell / u_strength are preserved from the .pen use-site
// (u_gridColor #2a7fff, u_cell 46, u_strength 0.85).
//
// Consumed as THREE.ShaderMaterial with glslVersion: THREE.GLSL1.

varying vec2 vUv;

uniform vec3 u_gridColor;
uniform float u_cell;
uniform float u_strength;
uniform vec2 u_scale; // plane "pixel" extent so vUv*u_scale ~ grid units

void main() {
  vec2 uv = vUv;

  // radial spotlight, softened so the grid stays visible across the whole plane
  // (visibility tweak; grid.glsl is still the source of truth for the recipe).
  vec2 c = uv - vec2(0.5, 0.42);
  float vig = 1.0 - smoothstep(0.4, 1.3, length(c)) * 0.55;

  vec2 fc = uv * u_scale;
  vec2 p = fc / u_cell;
  vec2 fr = fract(p);
  vec2 d = min(fr, 1.0 - fr);
  float line = min(d.x, d.y);
  float fine = 1.0 - smoothstep(0.0, 0.030, line);

  vec2 p2 = fc / (u_cell * 5.0);
  vec2 fr2 = fract(p2);
  vec2 d2 = min(fr2, 1.0 - fr2);
  float line2 = min(d2.x, d2.y);
  float major = 1.0 - smoothstep(0.0, 0.012, line2);

  float alpha = (fine * 0.45 + major * 0.95) * vig * u_strength + 0.04;
  gl_FragColor = vec4(u_gridColor, alpha);
}
