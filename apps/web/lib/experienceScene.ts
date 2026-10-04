import gsap from "gsap";
import * as THREE from "three";
import { createGltfLoader } from "./gltf";

export interface SpecimenStage {
  column: string;
  label: string;
  value: string | null;
}

export type ScenePhase = "arrival" | "question" | "dependency" | "evidence" | "handoff";

export interface SceneOptions {
  onPick: (column: string) => void;
  onContextLost: () => void;
  reducedMotion: () => boolean;
  signal: AbortSignal;
}

export interface SceneHandle {
  setPhase: (phase: ScenePhase) => void;
  setSpecimen: (stages: SpecimenStage[] | null) => void;
  highlight: (column: string | null) => void;
  settle: () => void;
  dispose: () => void;
}

const TERRAIN_URL = "/experience/terrain/terrain.glb";
const TERRAIN_LOW_URL = "/experience/terrain/terrain-low.glb";
const SHELTER_URL = "/experience/mint/shelter/web.glb";
const SPECIMEN_PHASES: ScenePhase[] = ["dependency", "evidence", "handoff"];

function token(name: string, fallback: string): THREE.Color {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  return new THREE.Color(value);
}

function terrainMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      stone: { value: token("--page", "#161c18") },
      moss: { value: token("--moss", "#b5c99a") },
      glacier: { value: token("--cursor", "#9ac4cb") },
      lineCol: { value: token("--rule", "#475247") },
      lightDir: { value: new THREE.Vector3(-0.55, 0.8, -0.35).normalize() },
    },
    vertexShader: `
      varying float vHeightMetres;
      varying vec3 vWorldNormal;
      void main() {
        vHeightMetres = position.y * 500.0;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying float vHeightMetres;
      varying vec3 vWorldNormal;
      uniform vec3 stone;
      uniform vec3 moss;
      uniform vec3 glacier;
      uniform vec3 lineCol;
      uniform vec3 lightDir;
      void main() {
        float scaledMinor = vHeightMetres / 50.0;
        float dMinor = abs(fract(scaledMinor + 0.5) - 0.5);
        float aaMinor = max(fwidth(scaledMinor), 0.00001);
        float minor = 1.0 - smoothstep(0.015 - aaMinor, 0.015 + aaMinor, dMinor);
        float scaledMajor = vHeightMetres / 250.0;
        float dMajor = abs(fract(scaledMajor + 0.5) - 0.5);
        float aaMajor = max(fwidth(scaledMajor), 0.00001);
        float major = 1.0 - smoothstep(0.01 - aaMajor, 0.01 + aaMajor, dMajor);
        float line = max(minor * 0.35, major);
        float shade = 0.45 + 0.55 * max(dot(normalize(vWorldNormal), normalize(lightDir)), 0.0);
        float h = clamp(vHeightMetres / 1100.0, 0.0, 1.0);
        vec3 base = mix(stone, moss, 0.10 + 0.15 * h);
        base = mix(base, glacier, smoothstep(0.7, 1.0, h) * 0.18);
        vec3 col = mix(base * shade, lineCol, line * 0.5);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function trackMaterials(root: THREE.Object3D, resources: Set<{ dispose(): void }>) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.geometry) resources.add(m.geometry);
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    mats.forEach((mat) => {
      resources.add(mat);
      const mm = mat as THREE.MeshStandardMaterial;
      for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap"] as const) {
        const tex = mm[key];
        if (tex) resources.add(tex);
      }
    });
  });
}

function disposeModel(root: THREE.Object3D) {
  const tmp = new Set<{ dispose(): void }>();
  trackMaterials(root, tmp);
  tmp.forEach((r) => r.dispose());
  tmp.clear();
}

let ordinalAtlasTexture: THREE.CanvasTexture | null = null;
function ordinalAtlas(): THREE.CanvasTexture {
  if (ordinalAtlasTexture) return ordinalAtlasTexture;
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.font = "600 64px ui-monospace, monospace";
  ctx.fillStyle = "#e8e4d8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 8; i++) ctx.fillText(String(i + 1).padStart(2, "0"), i * 128 + 64, 66);
  ordinalAtlasTexture = new THREE.CanvasTexture(c);
  return ordinalAtlasTexture;
}

export async function createScene(canvas: HTMLCanvasElement, opts: SceneOptions): Promise<SceneHandle> {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  const resources = new Set<{ dispose(): void }>();
  const cleanups: (() => void)[] = [];
  let disposed = false;
  let contextLost = false;
  let timeline: gsap.core.Timeline | null = null;
  let strata: THREE.Group | null = null;
  let currentPhase: ScenePhase = "arrival";
  let pendingRaf = 0;
  let frames = 0;
  let ro: ResizeObserver | null = null;

  const teardown = () => {
    if (disposed) return;
    disposed = true;
    timeline?.kill();
    if (pendingRaf) cancelAnimationFrame(pendingRaf);
    pendingRaf = 0;
    cleanups.forEach((fn) => fn());
    cleanups.length = 0;
    ro?.disconnect();
    if (strata) disposeModel(strata);
    resources.forEach((r) => r.dispose());
    resources.clear();
    renderer.dispose();
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
    teardown();
    opts.onContextLost();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  cleanups.push(() => canvas.removeEventListener("webglcontextlost", onLost));
  if (opts.signal.aborted) { teardown(); throw new Error("aborted"); }
  const onAbort = () => teardown();
  opts.signal.addEventListener("abort", onAbort, { once: true });
  cleanups.push(() => opts.signal.removeEventListener("abort", onAbort));

  try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 640 ? 1 : 1.5));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 400);
    const target = new THREE.Vector3();
    const hemi = new THREE.HemisphereLight(token("--panel", "#202822"), token("--page", "#161c18"), 1.4);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(token("--text-strong", "#eee9dc"), 1.1);
    sun.position.set(-4, 7, -3);
    scene.add(sun);

    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const url = (window.innerWidth < 640 || conn?.saveData) ? TERRAIN_LOW_URL : TERRAIN_URL;
    const loader = await createGltfLoader();
    const gltf = await loader.loadAsync(url);
    if (disposed || contextLost || opts.signal.aborted) {
      disposeModel(gltf.scene);
      throw new Error("scene disposed during load");
    }

    const terrainMat = terrainMaterial();
    resources.add(terrainMat);
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        const old = mesh.material;
        (Array.isArray(old) ? old : old ? [old] : []).forEach((mat) => {
          const mm = mat as THREE.MeshStandardMaterial;
          for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap"] as const) {
            mm[key]?.dispose();
          }
          (mat as THREE.Material).dispose();
        });
        mesh.material = terrainMat;
        resources.add(mesh.geometry);
      }
    });
    const terrain = gltf.scene;
    scene.add(terrain);

    const terrainBox = new THREE.Box3().setFromObject(terrain);
    const center = terrainBox.getCenter(new THREE.Vector3());
    terrain.position.sub(center);

    const shelterGltf = await loader.loadAsync(SHELTER_URL);
    if (disposed || contextLost || opts.signal.aborted) {
      disposeModel(shelterGltf.scene);
      throw new Error("scene disposed during shelter load");
    }
    const shelter = shelterGltf.scene;
    trackMaterials(shelter, resources);
    const sbox = new THREE.Box3().setFromObject(shelter);
    const ssize = sbox.getSize(new THREE.Vector3());
    const scale = 1.15 / ssize.x;
    shelter.scale.setScalar(scale);
    const groundRay = new THREE.Raycaster();
    groundRay.set(new THREE.Vector3(1.1, 30, 0.6), new THREE.Vector3(0, -1, 0));
    const hit = groundRay.intersectObject(terrain, true)[0];
    const ground = hit ? hit.point : new THREE.Vector3(1.1, 0.4, 0.6);
    const sc = sbox.getCenter(new THREE.Vector3()).multiplyScalar(scale);
    shelter.position.set(ground.x - sc.x, ground.y - sbox.min.y * scale, ground.z - sc.z);
    scene.add(shelter);
    const door = new THREE.PointLight(token("--shelter", "#dfad73"), 0.35, 0.9);
    const sH = (sbox.max.y - sbox.min.y) * scale;
    door.position.set(ground.x, ground.y + sH * 0.3, ground.z + ssize.z * scale * 0.55);
    scene.add(door);

    let specimenBox: THREE.Box3 | null = null;
    const poses: Record<ScenePhase, () => { pos: THREE.Vector3; look: THREE.Vector3 }> = {
      arrival: () => ({
        pos: shelter.position.clone().add(new THREE.Vector3(1.7, sH * 1.5, 3.1)),
        look: shelter.position.clone().add(new THREE.Vector3(0, sH * 0.45, 0)),
      }),
      question: () => ({
        pos: shelter.position.clone().add(new THREE.Vector3(0.9, sH * 0.9, 1.7)),
        look: shelter.position.clone().add(new THREE.Vector3(0, sH * 0.35, 0)),
      }),
      dependency: () => specimenPose(0),
      evidence: () => specimenPose(-0.15),
      handoff: () => specimenPose(0),
    };
    function specimenPose(offset: number) {
      if (specimenBox) {
        const c = specimenBox.getCenter(new THREE.Vector3());
        const size = specimenBox.getSize(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z) * 0.5 + 0.9;
        const fovRad = (camera.fov * Math.PI) / 180;
        const half = Math.min(fovRad, 2 * Math.atan(Math.tan(fovRad / 2) * camera.aspect * 0.68)) / 2;
        const dist = radius / Math.tan(half);
        return {
          pos: c.clone().add(new THREE.Vector3(dist * 0.15, size.y * 0.3 + offset, dist)),
          look: c.clone(),
        };
      }
      return { pos: new THREE.Vector3(0.4, 3.4, 4.4), look: new THREE.Vector3(0, 2.4, 0) };
    }
    camera.position.copy(poses.arrival().pos);
    target.copy(poses.arrival().look);

    const renderOnce = () => {
      pendingRaf = 0;
      if (disposed || contextLost || document.hidden) return;
      camera.lookAt(target);
      renderer.render(scene, camera);
      frames += 1;
      canvas.dataset.frames = String(frames);
      canvas.dataset.triangles = String(renderer.info.render.triangles);
      canvas.dataset.drawCalls = String(renderer.info.render.calls);
      canvas.dataset.textures = String(renderer.info.memory.textures);
      if (strata?.visible) {
        const v = new THREE.Vector3();
        let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
        strata.children.forEach((o) => {
          o.getWorldPosition(v);
          v.project(camera);
          const sx = (v.x * 0.5 + 0.5) * canvas.clientWidth;
          const sy = (0.5 - v.y * 0.5) * canvas.clientHeight;
          minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
          minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
        });
        canvas.dataset.slabs = `${Math.round(minX)},${Math.round(minY)}-${Math.round(maxX)},${Math.round(maxY)}`;
      }
    };
    const invalidate = () => {
      if (disposed || contextLost || document.hidden || pendingRaf) return;
      pendingRaf = requestAnimationFrame(renderOnce);
    };

    const size = () => {
      const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 1;
      const h = canvas.clientHeight || canvas.parentElement?.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      if (window.innerWidth >= 900 && SPECIMEN_PHASES.includes(currentPhase)) {
        camera.setViewOffset(w, h, -0.18 * w, 0, w, h);
      } else {
        camera.clearViewOffset();
      }
      camera.updateProjectionMatrix();
      invalidate();
    };
    size();
    ro = new ResizeObserver(size);
    ro.observe(canvas);

    const onVis = () => {
      if (document.hidden) {
        timeline?.pause();
        if (pendingRaf) cancelAnimationFrame(pendingRaf);
        pendingRaf = 0;
      } else {
        timeline?.resume();
        invalidate();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    cleanups.push(() => document.removeEventListener("visibilitychange", onVis));

    const pointer = new THREE.Vector2();
    const down = (e: PointerEvent) => {
      if (!strata || !strata.visible || !SPECIMEN_PHASES.includes(currentPhase)) return;
      const r = canvas.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      groundRay.setFromCamera(pointer, camera);
      const leaves = (strata.userData.leaves ?? []) as THREE.Mesh[];
      const picked = groundRay.intersectObjects(leaves, false)[0];
      const column = picked?.object.userData.column as string | undefined;
      if (column) opts.onPick(column);
    };
    canvas.addEventListener("pointerdown", down);
    cleanups.push(() => canvas.removeEventListener("pointerdown", down));

    const goTo = (pose: { pos: THREE.Vector3; look: THREE.Vector3 }, instant: boolean) => {
      timeline?.kill();
      timeline = null;
      if (instant || opts.reducedMotion()) {
        camera.position.copy(pose.pos);
        target.copy(pose.look);
        invalidate();
        return;
      }
      timeline = gsap.timeline()
        .to(camera.position, { x: pose.pos.x, y: pose.pos.y, z: pose.pos.z, duration: 1.6, ease: "power2.inOut", onUpdate: invalidate }, 0)
        .to(target, { x: pose.look.x, y: pose.look.y, z: pose.look.z, duration: 1.6, ease: "power2.inOut", onUpdate: invalidate }, 0);
    };

    const api: SceneHandle = {
      setPhase(phase) {
        if (disposed) return;
        currentPhase = phase;
        if (strata) strata.visible = SPECIMEN_PHASES.includes(phase);
        size();
        goTo(poses[phase](), phase === "arrival");
      },
      setSpecimen(stages) {
        if (disposed) return;
        if (strata) {
          disposeModel(strata);
          scene.remove(strata);
          strata = null;
        }
        specimenBox = null;
        if (!stages || !stages.length) { invalidate(); return; }
        strata = new THREE.Group();
        const coverMat = new THREE.MeshLambertMaterial({ color: token("--panel", "#202822") });
        const spineMat = new THREE.MeshLambertMaterial({ color: token("--rule", "#475247") });
        const cover = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.5, 0.06), coverMat);
        cover.position.set(0, 2.0, 0.52);
        const spine = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.62, 0.1), spineMat);
        spine.position.set(-1.28, 2.0, 0.55);
        strata.add(cover, spine);
        const paper = token("--text-faint", "#a5afa2");
        const stoneLeaf = token("--rule", "#475247");
        const leafW = 0.24;
        const gap = 0.05;
        const pitch = leafW + gap;
        const atlas = ordinalAtlas();
        const leaves: THREE.Mesh[] = [];
        stages.forEach((stage, i) => {
          if (stage.value === null) return;
          const geo = new THREE.BoxGeometry(leafW, 1.3, 0.04);
          const mat = new THREE.MeshLambertMaterial({ color: i % 2 ? stoneLeaf : paper });
          const leaf = new THREE.Mesh(geo, mat);
          const x = (i - (stages.length - 1) / 2) * pitch;
          leaf.position.set(x, 2.05, 0.62);
          leaf.rotation.x = -0.05;
          leaf.rotation.y = (i - (stages.length - 1) / 2) * 0.015;
          leaf.userData.column = stage.column;
          leaf.userData.base = leaf.position.clone();
          const slice = atlas.clone();
          slice.repeat.set(1 / 8, 1);
          slice.offset.set(i / 8, 0);
          slice.needsUpdate = true;
          const tag = new THREE.Mesh(
            new THREE.PlaneGeometry(0.16, 0.14),
            new THREE.MeshBasicMaterial({ map: slice, transparent: true }),
          );
          tag.position.set(x, 1.56, 0.646);
          tag.rotation.x = -0.05;
          strata!.add(leaf, tag);
          leaves.push(leaf);
        });
        strata.userData.leaves = leaves;
        specimenBox = new THREE.Box3().setFromObject(strata);
        strata.visible = SPECIMEN_PHASES.includes(currentPhase);
        scene.add(strata);
        if (SPECIMEN_PHASES.includes(currentPhase)) goTo(poses[currentPhase](), true);
        invalidate();
      },
      highlight(column) {
        if (disposed || !strata) return;
        const leaves = (strata.userData.leaves ?? []) as THREE.Mesh[];
        leaves.forEach((o) => {
          const m = o as THREE.Mesh;
          const mat = m.material as THREE.MeshLambertMaterial;
          if (!m.userData.frozen) {
            m.userData.frozen = (mat.color as THREE.Color).clone();
          }
          const selected = m.userData.column === column;
          mat.color.copy(selected ? token("--cursor", "#9ac4cb") : m.userData.frozen);
          const basePos = m.userData.base as THREE.Vector3;
          m.position.copy(basePos);
          if (selected) m.position.y += 0.09;
        });
        invalidate();
      },
      settle() {
        if (disposed) return;
        timeline?.kill();
        timeline = null;
        const pose = poses[currentPhase]();
        camera.position.copy(pose.pos);
        target.copy(pose.look);
        invalidate();
      },
      dispose: teardown,
    };

    if (renderer.compileAsync) {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          renderer.compileAsync(scene, camera),
          new Promise((_, rej) => { timeout = setTimeout(() => rej(new Error("compile timeout")), 4000); }),
        ]);
      } catch (e) { void e; } finally { if (timeout) clearTimeout(timeout); }
    }
    if (disposed || contextLost) throw new Error("scene lost during warmup");
    invalidate();
    return api;
  } catch (err) {
    teardown();
    throw err;
  }
}
