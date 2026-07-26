// gridGround.glsl — the cyber grid-ground fragment shader (source of truth).
// Drives a fine grid + every-5th major grid + radial vignette from the plane's
// vUv so the grid tracks the ground (a gl_FragCoord/u_resolution variant would
// "swim" across the 3D plane as the camera moves). Uniforms u_gridColor /
// u_cell / u_strength are preserved from the .pen use-site
// (u_gridColor #2a7fff, u_cell 46, u_strength 0.85).
//
// Consumed as THREE.ShaderMaterial with glslVersion: THREE.GLSL1.

varying vec2 vUv;

uniform vec3 u_gridColor;
uniform float u_cell;
uniform float u_strength;
uniform vec2 u_scale; // plane "pixel" extent so vUv*u_scale ~ grid units
// v2.28+ 网格脉冲（cyber tech-feel 效果之一）：当 u_pulseSpeed > 0 时叠加从
// 园区中心向外辐射的亮度波（u_wavelength 控制波长）。reduced-motion / 其它风格
// 把 u_pulseSpeed 设为 0 → 跳过该分支（无 GLSL 编译损失）。
uniform float u_time;
uniform float u_pulseSpeed;
uniform float u_wavelength;

void main() {
  vec2 uv = vUv;

  // radial spotlight, softened so the grid stays visible across the whole plane.
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

  // v2.28+ 网格脉冲：center→edge 半径方向径向波（叠加到 alpha 上）
  float pulse = 0.0;
  if (u_pulseSpeed > 0.0) {
    float dist = length(c);   // 复用 c（已是 center 偏移）
    float wave = sin(dist * u_wavelength - u_time * u_pulseSpeed) * 0.5 + 0.5;
    pulse = wave * vig * 0.22;
  }

  gl_FragColor = vec4(u_gridColor, alpha + pulse);
}
