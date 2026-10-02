import * as THREE from 'three';

// Depth-aware valley mist: the terrain depth ends the ray, so clouds cannot
// bleed through foreground ridges. All coordinates and step lengths are metres.
export function createAtmosphere(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, center: THREE.Vector3) {
  const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, samples: 2 });
  target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  const uniforms = {
    sceneColor: { value: target.texture }, sceneDepth: { value: target.depthTexture },
    inverseProjection: { value: camera.projectionMatrixInverse }, cameraWorld: { value: camera.matrixWorld },
    eye: { value: camera.position }, center: { value: center }, time: { value: 0 }
  };
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, uniforms,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `
      varying vec2 vUv; uniform sampler2D sceneColor, sceneDepth;
      uniform mat4 inverseProjection, cameraWorld;
      uniform vec3 eye, center; uniform float time;
      float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      float noise(vec3 p){
        vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+1.),f.x),f.y),f.z);
      }
      void main(){
        vec3 color=texture2D(sceneColor,vUv).rgb;
        vec4 view=inverseProjection*vec4(vUv*2.-1.,texture2D(sceneDepth,vUv).x*2.-1.,1.);
        view.xyz/=view.w;
        vec3 ray=normalize(mat3(cameraWorld)*view.xyz);
        vec3 halfSize=vec3(3200.,450.,6500.);
        vec3 boundsA=(center-halfSize-eye)/ray, boundsB=(center+halfSize-eye)/ray;
        vec3 nearB=min(boundsA,boundsB), farB=max(boundsA,boundsB);
        float entry=max(0.,max(nearB.x,max(nearB.y,nearB.z)));
        float end=min(length(view.xyz),min(farB.x,min(farB.y,farB.z)));
        if(end>entry){
          float stepSize=(end-entry)/12.;
          float jitter=hash(vec3(gl_FragCoord.xy,1.));
          float transmittance=1.; vec3 light=vec3(0.);
          for(int i=0;i<12;i++){
            vec3 p=eye+ray*(entry+(float(i)+jitter)*stepSize);
            vec3 q=(p-center)/vec3(1300.,210.,4600.);
            float envelope=exp(-2.4*q.x*q.x-2.2*q.y*q.y-pow(q.z,4.));
            vec3 drift=p*.0018+vec3(time*.008,0.,time*.002);
            float n=noise(drift)*.65+noise(drift*2.1)*.35;
            float density=smoothstep(.32,.75,n)*envelope;
            float opacity=1.-exp(-density*stepSize*.00062);
            vec3 tint=mix(vec3(.51,.60,.61),vec3(.77,.79,.73),smoothstep(-.8,.8,q.y));
            light+=transmittance*opacity*tint;
            transmittance*=1.-opacity;
          }
          color=color*transmittance+light;
        }
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const screen = new THREE.Scene(); screen.add(new THREE.Mesh(geometry, material));
  const screenCamera = new THREE.Camera();
  return {
    resize(width: number, height: number) { const ratio = renderer.getPixelRatio(); target.setSize(Math.floor(width * ratio), Math.floor(height * ratio)); },
    render(scene: THREE.Scene, time: number) {
      uniforms.time.value = time;
      renderer.setRenderTarget(target); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.render(screen, screenCamera);
    },
    dispose() { target.dispose(); target.depthTexture?.dispose(); geometry.dispose(); material.dispose(); }
  };
}
