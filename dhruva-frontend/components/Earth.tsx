"use client";

import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";

export default function Earth() {
  const texture = useLoader(TextureLoader, "/textures/earth.jpg");

  return (
    <mesh>
      <sphereGeometry args={[6.371, 96, 96]} />
      <meshStandardMaterial
        map={texture}
        metalness={0}
        roughness={0.6}
      />
    </mesh>
  );
}

