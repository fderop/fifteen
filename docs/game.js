"use strict";

const outerWidth = 4;
const innerWidth = 3;
const gridWidth = outerWidth * innerWidth;
const outerColors = [
  "transparent", "#ff6464", "#ff6464", "#ff6464", "#ff6464",
  "#fff55a", "#75ff60", "#75ff60", "#75ff60", "#fff55a",
  "#75ffdc", "#8fb1fa", "#8fb1fa", "#fff55a", "#75ffdc", "#c78af5",
];
const board = document.querySelector("#board");
const timer = document.querySelector("#timer");
let outer;
let challenge;
let startedAt;
let timerFrame;
let previousPoint = null;

function isSolved(cells) {
  return cells.every((tile, index) => tile === (index + 1) % cells.length);
}

function scramble(width, gapIndex) {
  const count = width * width;
  let cells;
  let solvable;
  do {
    cells = Array.from({ length: count }, (_, index) => index);
    for (let index = count - 1; index > 0; index--) {
      const random = Math.floor(Math.random() * (index + 1));
      [cells[index], cells[random]] = [cells[random], cells[index]];
    }
    if (gapIndex !== undefined) {
      const originalGap = cells.indexOf(0);
      [cells[originalGap], cells[gapIndex]] = [cells[gapIndex], cells[originalGap]];
    }
    let inversions = 0;
    for (let index = 0; index < count; index++) {
      for (const tile of cells.slice(index + 1)) {
        if (tile !== 0 && tile < cells[index]) inversions++;
      }
    }
    const rowFromBottom = width - Math.floor(cells.indexOf(0) / width);
    solvable = width % 2 ? inversions % 2 === 0 : (inversions + rowFromBottom) % 2 === 1;
  } while (!solvable || isSolved(cells));
  return cells;
}

function adjacent(index, gap, width) {
  return Math.abs(Math.floor(index / width) - Math.floor(gap / width)) +
    Math.abs(index % width - gap % width) === 1;
}

function tileElement(tile, mini) {
  const element = document.createElement("div");
  element.className = mini ? "mini" : "cell";
  element.dataset.number = tile;
  element.textContent = tile || "";
  return element;
}

function render() {
  const tiles = outer.map((tile, index) => {
    if (challenge?.tileIndex === index) {
      const nested = document.createElement("div");
      nested.className = "challenge";
      nested.setAttribute("aria-label", "Tile " + tile + " puzzle");
      nested.append(...challenge.cells.map(number => tileElement(number, true)));
      return nested;
    }
    const element = tileElement(tile, false);
    element.style.setProperty("--fill", outerColors[tile]);
    return element;
  });
  board.replaceChildren(...tiles);
}

function updateTimer(now) {
  timer.textContent = ((now - startedAt) / 1000).toFixed(3);
  if (!isSolved(outer)) timerFrame = requestAnimationFrame(updateTimer);
}

function beginChallenge(index, gap) {
  if (isSolved(outer) || !adjacent(index, outer.indexOf(0), outerWidth)) return false;
  challenge = { tileIndex: index, cells: scramble(innerWidth, gap) };
  if (startedAt === null) {
    startedAt = performance.now();
    timerFrame = requestAnimationFrame(updateTimer);
  }
  render();
  return true;
}

function slideInner(index) {
  const cells = challenge.cells;
  const gap = cells.indexOf(0);
  if (!adjacent(index, gap, innerWidth)) return false;
  [cells[gap], cells[index]] = [cells[index], cells[gap]];
  if (isSolved(cells)) {
    const outerGap = outer.indexOf(0);
    const index = challenge.tileIndex;
    [outer[outerGap], outer[index]] = [outer[index], outer[outerGap]];
    challenge = null;
    if (isSolved(outer)) {
      cancelAnimationFrame(timerFrame);
      updateTimer(performance.now());
    }
  }
  render();
  return true;
}

function restart(gap) {
  cancelAnimationFrame(timerFrame);
  outer = scramble(outerWidth, gap);
  challenge = null;
  startedAt = null;
  timer.textContent = "0.000";
  render();
}

function gridCell({ x, y }) {
  const row = Math.floor(y);
  const col = Math.floor(x);
  if (row < 0 || row >= gridWidth || col < 0 || col >= gridWidth) return null;
  return row * gridWidth + col;
}

function outerIndex(cell) {
  const row = Math.floor(cell / gridWidth);
  const col = cell % gridWidth;
  return Math.floor(row / innerWidth) * outerWidth + Math.floor(col / innerWidth);
}

function innerIndex(cell) {
  const row = Math.floor(cell / gridWidth);
  const col = cell % gridWidth;
  return (row % innerWidth) * innerWidth + col % innerWidth;
}

function cellsCrossed(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const crossings = [0, 1];
  for (const [start, distance] of [[from.x, dx], [from.y, dy]]) {
    for (let edge = 0; edge <= gridWidth; edge++) {
      const fraction = (edge - start) / distance;
      if (fraction > 0 && fraction < 1) crossings.push(fraction);
    }
  }
  crossings.sort((a, b) => a - b);
  return crossings.slice(1).map((end, index) => {
    const fraction = (crossings[index] + end) / 2;
    return gridCell({ x: from.x + dx * fraction, y: from.y + dy * fraction });
  });
}

function trackPointer(event) {
  const bounds = board.getBoundingClientRect();
  const point = {
    x: (event.clientX - bounds.left) / bounds.width * gridWidth,
    y: (event.clientY - bounds.top) / bounds.height * gridWidth,
  };
  let last = previousPoint === null ? null : gridCell(previousPoint);
  const end = gridCell(point);
  const path = previousPoint === null ? [] : cellsCrossed(previousPoint, point);
  previousPoint = end === null ? null : point;
  for (const cell of [...path, end]) {
    if (cell === null || cell === last) continue;
    const previousOuter = last === null ? null : outerIndex(last);
    last = cell;
    const tile = outerIndex(cell);
    if (challenge) {
      if (tile === challenge.tileIndex && slideInner(innerIndex(cell)) && !challenge) break;
    } else if (tile !== previousOuter) {
      const cursor = end !== null && outerIndex(end) === tile ? end : cell;
      if (beginChallenge(tile, innerIndex(cursor))) break;
    }
  }
}

board.addEventListener("pointermove", trackPointer);
board.addEventListener("pointerleave", () => { previousPoint = null; });
board.addEventListener("pointerdown", event => {
  if (event.pointerType !== "mouse") {
    previousPoint = null;
    board.setPointerCapture(event.pointerId);
  }
  trackPointer(event);
});
for (const type of ["pointerup", "pointercancel"]) {
  board.addEventListener(type, event => {
    if (event.pointerType !== "mouse") previousPoint = null;
  });
}

document.addEventListener("keydown", event => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  if (event.key.toLowerCase() === "r") {
    const cell = previousPoint === null ? null : gridCell(previousPoint);
    restart(cell === null ? undefined : outerIndex(cell));
  }
});

board.addEventListener("keydown", event => {
  const width = challenge ? innerWidth : outerWidth;
  const offset = { ArrowUp: width, ArrowDown: -width, ArrowLeft: 1, ArrowRight: -1 }[event.key];
  if (offset === undefined) return;
  event.preventDefault();
  const cells = challenge?.cells ?? outer;
  const index = cells.indexOf(0) + offset;
  if (index < 0 || index >= cells.length) return;
  if (challenge) slideInner(index);
  else beginChallenge(index, 4);
});

restart();
