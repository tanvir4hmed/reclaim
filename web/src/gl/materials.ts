import * as THREE from 'three';
import { mat } from './decay';

/** Shared physically based materials. Each has a Day look and how it ages after the Reveal. */
export const M = {
  brass: () => mat('brass', { surface: 'metal', color: '#d4a64a', metalness: 1, roughness: 0.28, hauntedColor: '#6e5a33', decay: { age: 0.7, dust: 0.4 } }),
  darkBrass: () => mat('darkBrass', { surface: 'metal', color: '#8c6a2c', metalness: 1, roughness: 0.4, hauntedColor: '#3f3322', decay: { age: 0.6 } }),
  silver: () => mat('silver', { surface: 'metal', color: '#d9dde2', metalness: 1, roughness: 0.18, hauntedColor: '#6d6a64', decay: { age: 0.7, dust: 0.3 } }),
  enamel: () => mat('enamel', { surface: 'ceramic', color: '#f6f0e2', roughness: 0.25, clearcoat: 1, hauntedColor: '#b9ad92', decay: { age: 0.8, dust: 0.3 } }),
  ink: () => mat('ink', { color: '#1b1714', roughness: 0.4 }),
  glass: () =>
    mat('glass', { color: '#ffffff', roughness: 0.03, transmission: 1, thickness: 0.4, opacity: 1, hauntedColor: '#c9c3b5', decay: { age: 0.4, dust: 0.6 } }),
  mirror: () => mat('mirror', { surface: 'metal', color: '#cfd6dc', metalness: 1, roughness: 0.04, hauntedColor: '#4c5054', decay: { age: 0.5, dust: 0.5 } }),
  paper: () => mat('paper', { surface: 'paper', color: '#efe4cc', roughness: 0.9, hauntedColor: '#8a7250', decay: { age: 1, tear: 0.35, dust: 0.3 } }),
  paperDark: () => mat('paperDark', { surface: 'paper', color: '#d9c8a6', roughness: 0.9, hauntedColor: '#8d7553', decay: { age: 1, tear: 0.3 } }),
  wax: () => mat('wax', { surface: 'wax', color: '#9b1b24', roughness: 0.35, clearcoat: 0.6, hauntedColor: '#4a0f13', decay: { age: 0.3 } }),
  // After the Reveal: old leather, not polished. Matte, greyed with dust, scuffed and cold-scorched.
  leather: () =>
    mat('leather', { surface: 'leather', color: '#6b3a22', roughness: 0.55, clearcoat: 0.4, hauntedColor: '#2e241d', matte: 1, decay: { burn: 0.22, tear: 0.12, dust: 0.45, age: 0.7 } }),
  leatherSole: () => mat('leatherSole', { surface: 'leather', color: '#2b1c14', roughness: 0.7, hauntedColor: '#221a15', matte: 1, decay: { burn: 0.15, dust: 0.8, age: 1 } }),
  /** Boot eyelets: brass by day, tarnished nearly black after the Reveal. */
  eyelet: () => mat('eyelet', { surface: 'metal', color: '#c9a14a', metalness: 0.9, roughness: 0.35, hauntedColor: '#2c2822', matte: 1, decay: { age: 1, dust: 0.8 } }),
  lace: () => mat('lace', { color: '#f4efe6', roughness: 0.8, hauntedColor: '#5a5248', decay: { burn: 0.25 } }),
  wood: () => mat('wood', { surface: 'wood', color: '#7a4a28', roughness: 0.45, clearcoat: 0.5, hauntedColor: '#3b2a1e', decay: { age: 0.6, dust: 0.6 } }),
  woodLight: () => mat('woodLight', { surface: 'wood', color: '#c79a64', roughness: 0.5, clearcoat: 0.3, hauntedColor: '#6b5640', decay: { age: 0.6, dust: 0.5 } }),
  gilt: () => mat('gilt', { surface: 'metal', color: '#c8a24c', metalness: 0.9, roughness: 0.32, hauntedColor: '#5e4c2c', decay: { age: 0.7, dust: 0.6 } }),
  /** Old upholstery cloth: off-white like ghee by day; yellowed, greyed and grubby after the Reveal. */
  upholstery: () =>
    mat('upholstery', { surface: 'fabric', color: '#ebdfc3', roughness: 0.92, sheen: 0.35, sheenColor: '#fff6e0', hauntedColor: '#a59a83', decay: { age: 0.6, dust: 0.5, tear: 0.08 } }),
  /** The doll's dress and hat: deep red velvet by day; after the Reveal faded, dusty, dark red. */
  dollVelvet: () =>
    mat('dollVelvet', { surface: 'fabric', color: '#7e0c14', roughness: 0.82, sheen: 0.55, sheenColor: '#c43a40', hauntedColor: '#5a161b', decay: { age: 0.5, dust: 0.55, tear: 0.2 } }),
  /** White fur trim: snowy by day, grey-beige and matted after the Reveal. */
  dollFur: () => mat('dollFur', { surface: 'fur', color: '#f6f2ea', roughness: 1, sheen: 0.8, sheenColor: '#ffffff', hauntedColor: '#a19784', decay: { dust: 0.7, age: 0.4 } }),
  /** Her ringlets: golden brown by day; dull, dusty brown after the Reveal. */
  dollHair: () => mat('dollHair', { surface: 'fur', color: '#b47a3c', roughness: 0.55, sheen: 0.9, sheenColor: '#ffd59a', hauntedColor: '#6b5236', decay: { dust: 0.6 } }),
  /** Her porcelain: warm and smooth by day; grey and grimy after the Reveal. */
  dollPorcelain: () =>
    mat('dollPorcelain', { surface: 'ceramic', color: '#f6e2d4', roughness: 0.28, clearcoat: 0.6, hauntedColor: '#c9c1b4', decay: { age: 0.6, dust: 0.45 } }),
  velvetRed: () => mat('velvetRed', { surface: 'fabric', color: '#8e1620', roughness: 0.85, sheen: 1, sheenColor: '#ff9a9a', hauntedColor: '#3a0d10', decay: { age: 0.5, dust: 0.4, tear: 0.1 } }),
  porcelain: () => mat('porcelain', { surface: 'ceramic', color: '#f7e7dc', roughness: 0.3, clearcoat: 0.8, hauntedColor: '#a89a8a', decay: { age: 0.7, dust: 0.4 } }),
  hair: () => mat('hair', { surface: 'fur', color: '#6a3b1f', roughness: 0.75, sheen: 0.6, hauntedColor: '#2a1f18', decay: { dust: 0.5 } }),
  cloth: () => mat('cloth', { surface: 'fabric', color: '#7a0f18', roughness: 0.8, sheen: 0.25, sheenColor: '#ff5050', hauntedColor: '#3c1a1a', decay: { tear: 0.38, dust: 0.4 } }),
  clothWhite: () => mat('clothWhite', { surface: 'fabric', color: '#f5f1ea', roughness: 0.95, sheen: 0.6, hauntedColor: '#8f877a', decay: { tear: 0.3, dust: 0.4 } }),
  plush: () => mat('plush', { surface: 'fur', color: '#a5703f', roughness: 1, sheen: 1, sheenColor: '#f2c08a', hauntedColor: '#4a3828', decay: { tear: 0.3, dust: 0.5 } }),
  cream: () => mat('cream', { surface: 'cake', color: '#fbf4ea', roughness: 0.6, sheen: 0.4, hauntedColor: '#8f8a62', decay: { rot: 1, dust: 0.1 } }),
  sponge: () => mat('sponge', { surface: 'cake', color: '#e9c88e', roughness: 0.9, hauntedColor: '#5d5236', decay: { rot: 1 } }),
  berry: () => mat('berry', { color: '#c0162c', roughness: 0.25, clearcoat: 1, hauntedColor: '#2a1418', decay: { rot: 1 } }),
  chocolate: () => mat('chocolate', { surface: 'cake', color: '#4a2716', roughness: 0.35, clearcoat: 0.6, hauntedColor: '#2a1d16', decay: { dust: 0.5, rot: 0.4 } }),
  bakelite: () => mat('bakelite', { surface: 'ceramic', color: '#141210', roughness: 0.2, clearcoat: 1, hauntedColor: '#0b0a09', decay: { dust: 0.22, age: 0.2 } }),
  tin: () => mat('tin', { surface: 'metal', color: '#b8392f', metalness: 0.6, roughness: 0.35, hauntedColor: '#4c2a22', decay: { age: 0.6, dust: 0.4 } }),
  tinBlue: () => mat('tinBlue', { surface: 'metal', color: '#24407a', metalness: 0.6, roughness: 0.35, hauntedColor: '#1c2433', decay: { age: 0.6 } }),
  ribbon: () => mat('ribbon', { surface: 'fabric', color: '#d9b04f', metalness: 0.4, roughness: 0.35, sheen: 0.6, hauntedColor: '#5c4a2a', decay: { burn: 0.25 } }),
  giftPaper: () => mat('giftPaper', { surface: 'paper', color: '#a3141f', roughness: 0.55, clearcoat: 0.3, hauntedColor: '#341418', decay: { burn: 0.35, tear: 0.2 } }),
  knit: () => mat('knit', { surface: 'knit', color: '#b31b28', roughness: 1, sheen: 1, sheenColor: '#ffd0d0', hauntedColor: '#45201f', decay: { tear: 0.25, dust: 0.4 } }),
  candleWax: () => mat('candleWax', { surface: 'wax', color: '#f1e3c4', roughness: 0.6, transmission: 0.15, thickness: 0.5, hauntedColor: '#9c8e72', decay: { age: 0.4 } }),
  flame: () => mat('flame', { color: '#ffd27a', emissive: '#ffb547', emissiveIntensity: 3, roughness: 1 }),
  glow: () => mat('glow', { color: '#ffe1a3', emissive: '#ffcf70', emissiveIntensity: 2.2, roughness: 1, hauntedColor: '#6b5a3a' }),
  snow: () => mat('snow', { color: '#ffffff', roughness: 1, hauntedColor: '#5b5752' }),
  green: () => mat('green', { color: '#2f5a3a', roughness: 0.6, hauntedColor: '#2b2b25', decay: { dust: 0.5 } }),
  backdrop: () => mat('backdrop', { color: '#000000', roughness: 1, opacity: 0.35, side: THREE.DoubleSide }),
};
