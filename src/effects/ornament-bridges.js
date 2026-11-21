export function createOrnamentBridges(frame) {
  const pairs = [
    ['tl', 0, 4, false, false], ['tl', 1, 5, false, false],
    ['tr', 0, 7, true, false], ['tr', 1, 6, true, false],
    ['bl', 2, 5, false, true], ['bl', 3, 4, false, true],
    ['br', 2, 6, true, true], ['br', 3, 7, true, true],
  ];
  return pairs.map(([corner, horizontalIndex, verticalIndex, right, bottom]) => {
    const h = frame.rails[horizontalIndex];
    const v = frame.rails[verticalIndex];
    const hx = right ? h.x + h.width : h.x;
    const hy = h.y + h.height / 2;
    const vx = v.x + v.width / 2;
    const vy = bottom ? v.y + v.height : v.y;
    return { corner, width: h.height, points: [[hx, hy], [vx, hy], [vx, vy]] };
  });
}
