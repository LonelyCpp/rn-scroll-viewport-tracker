import type { ScrollBoxOffset } from './types';

function doBoxesOverlap(
  boxBig: ScrollBoxOffset,
  boxSmall: ScrollBoxOffset,
  minOverlapRatio: number
): boolean {
  // Extract the properties of the first box
  const left1 = boxBig.x;
  const right1 = boxBig.x + boxBig.width;
  const top1 = boxBig.y;
  const bottom1 = boxBig.y + boxBig.height;

  // Extract the properties of the second box
  const left2 = boxSmall.x;
  const right2 = boxSmall.x + boxSmall.width;
  const top2 = boxSmall.y;
  const bottom2 = boxSmall.y + boxSmall.height;

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

  const mainArea = boxBig.width * boxBig.height;
  const intersectingArea = intersectingBox.width * intersectingBox.height;

  const areaRatio = intersectingArea / mainArea;

  return areaRatio >= minOverlapRatio;
}

export { doBoxesOverlap };
