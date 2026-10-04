import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const DRACO_DECODER_PATH = "https://cdn.mint.gg/runtime/draco/gltf/three-0.184.0/";

let draco: DRACOLoader | null = null;
let dracoPromise: Promise<DRACOLoader> | null = null;

export async function createGltfLoader(): Promise<GLTFLoader> {
  if (!dracoPromise) {
    dracoPromise = import("three/addons/loaders/DRACOLoader.js").then((mod) => {
      draco = new mod.DRACOLoader();
      draco.setDecoderPath(DRACO_DECODER_PATH);
      return draco;
    });
  }
  const decoder = await dracoPromise;
  const loader = new GLTFLoader();
  loader.setDRACOLoader(decoder);
  return loader;
}

export function disposeDracoDecoder() {
  dracoPromise = null;
  draco?.dispose();
  draco = null;
}
