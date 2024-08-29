import type { ScrollBoxOffset } from './types';

function doBoxesOverlap(
  boxSmall: ScrollBoxOffset,
  boxBig: ScrollBoxOffset,
  minOverlapRatio: number
): boolean {
  // Extract the properties of the first box
  const left1 = boxSmall.x;
  const right1 = boxSmall.x + boxSmall.width;
  const top1 = boxSmall.y;
  const bottom1 = boxSmall.y + boxSmall.height;

  // Extract the properties of the second box
  const left2 = boxBig.x;
  const right2 = boxBig.x + boxBig.width;
  const top2 = boxBig.y;
  const bottom2 = boxBig.y + boxBig.height;

  // Check if the boxes do not overlap
  if (
    right1 <= left2 ||
    right2 <= left1 ||
    bottom1 <= top2 ||
    bottom2 <= top1
  ) {
    return false;
  }

  const intersectingBox = {
    width: Math.min(right1, right2) - Math.max(left1, left2),
    height: Math.min(bottom1, bottom2) - Math.max(top1, top2),
  };

  const smallBoxArea = boxSmall.width * boxSmall.height;
  const intersectingArea = intersectingBox.width * intersectingBox.height;

  const areaRatio = intersectingArea / smallBoxArea;

  return areaRatio >= minOverlapRatio;
}

export { doBoxesOverlap };
