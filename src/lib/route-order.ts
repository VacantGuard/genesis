export type Point = { lat: number; lng: number };

export function milesBetween(a: Point, b: Point) {
  const radius = 3958.8;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function leg(from: Point | null, to: Point) {
  return from ? milesBetween(from, to) : 0;
}

function pathMiles(start: Point | null, points: Point[]) {
  let total = 0;
  let previous = start;
  for (const point of points) {
    total += leg(previous, point);
    previous = point;
  }
  return total;
}

function nearestNeighbor(start: Point, points: Point[]) {
  const remaining = points.map((point, index) => ({ point, index }));
  const order: number[] = [];
  let current = start;
  while (remaining.length > 0) {
    let best = 0;
    let bestMiles = milesBetween(current, remaining[0].point);
    for (let i = 1; i < remaining.length; i += 1) {
      const miles = milesBetween(current, remaining[i].point);
      if (miles < bestMiles) {
        best = i;
        bestMiles = miles;
      }
    }
    const next = remaining.splice(best, 1)[0];
    order.push(next.index);
    current = next.point;
  }
  return order;
}

function twoOpt(start: Point | null, points: Point[], order: number[]) {
  const route = [...order];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < route.length - 1 && !improved; i += 1) {
      for (let k = i + 1; k < route.length; k += 1) {
        const candidate = [...route.slice(0, i), ...route.slice(i, k + 1).reverse(), ...route.slice(k + 1)];
        const before = pathMiles(
          start,
          route.map((index) => points[index]),
        );
        const after = pathMiles(
          start,
          candidate.map((index) => points[index]),
        );
        if (after + 0.05 < before) {
          route.splice(0, route.length, ...candidate);
          improved = true;
          break;
        }
      }
    }
  }
  return route;
}

export function orderByDistance(start: Point | null, points: Point[]) {
  if (points.length <= 1) return points.map((_, index) => index);
  if (!start) {
    let best: number[] = [];
    let bestMiles = Number.POSITIVE_INFINITY;
    for (let origin = 0; origin < points.length; origin += 1) {
      const rest = points.flatMap((point, index) => (index === origin ? [] : [{ point, index }]));
      const next = nearestNeighbor(
        points[origin],
        rest.map((item) => item.point),
      ).map((local) => rest[local].index);
      const improved = twoOpt(null, points, [origin, ...next]);
      const miles = pathMiles(
        null,
        improved.map((index) => points[index]),
      );
      if (miles < bestMiles) {
        best = improved;
        bestMiles = miles;
      }
    }
    return best;
  }
  return twoOpt(start, points, nearestNeighbor(start, points));
}
