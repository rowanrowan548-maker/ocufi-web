// Twitter card 复用 OG image 的渲染
import OG from './opengraph-image';

export const runtime = 'edge';
export const alt = 'Ocufi · 链上交易,应该回到你手里';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function TwitterImage() {
  return OG();
}
