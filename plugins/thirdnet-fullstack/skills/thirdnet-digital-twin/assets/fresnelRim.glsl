// fresnelRim.glsl — cheap Fresnel rim glow injection for the holographic style (v1.8).
//
// WHY: holographic wants "translucent body + bright edge glow". The expensive path is
// MeshPhysicalMaterial({ transmission }) — that needs a full transmission render pass
// and is a performance black-hole when stacked with bloom. This snippet is the cheap
// alternative: inject a view-normal Fresnel term into MeshStandardMaterial via
// onBeforeCompile so silhouette edges brighten toward the camera grazing angle. ~95% of
// the holographic look at ~10% of the cost.
//
// USAGE (holographic building bodies):
//   const mat = new THREE.MeshStandardMaterial({
//     color: token.category.building, transparent: true, opacity: 0.35,
//     emissive: token.category.building, emissiveIntensity: 0.3,
//     metalness: 0.1, roughness: 0.2,
//   })
//   mat.onBeforeCompile = (shader) => {
//     shader.uniforms.uRimColor = { value: new THREE.Color(token['cyan-bright']) }
//     shader.uniforms.uRimPower = { value: 3.0 }
//     shader.uniforms.uRimIntensity = { value: 0.6 }
//     shader.fragmentShader = 'uniform vec3 uRimColor; uniform float uRimPower; uniform float uRimIntensity;\n' +
//       shader.fragmentShader.replace(
//         '#include <emissivemap_fragment>',
//         '#include <emissivemap_fragment>\n' + FRESNEL_RIM_BODY,
//       )
//   }
//
// Inject this string AFTER `#include <emissivemap_fragment>` in the fragment shader.
// It relies on `normal` (view-space, available after #include <normal_fragment_maps>)
// and `geometryViewDir`/`vViewPosition` provided by the standard material's includes.
// (normal & view dir are established by the standard material's includes above the
// injection point, regardless of normal/bump/flat-shading flags.)
{
  vec3 vNormal = normalize(normal);
  // view direction: Three.js MeshStandardMaterial provides vViewPosition (position - viewPosition)
  vec3 vViewDir = normalize(vViewPosition);
  float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
  rim = pow(rim, uRimPower);
  totalEmissiveRadiance += uRimColor * rim * uRimIntensity;
}
