const FONT_NAMES = ["HaasLight", "HaasLight", "HaasRoman", "HaasRoman", "HaasMedium"];
const measure = document.createElement("canvas").getContext("2d");

export function createExperimentalParagraph(text, width, fontSize, random) {
  const words = text.trim().split(/\s+/);
  const rows = [];
  let row = [];
  let used = 0;

  for (const value of words) {
    const font = random.pick(FONT_NAMES);
    const scale = random.range(0.2, 1.5);
    measure.font = `${fontSize}px ${font}`;
    const normalWidth = measure.measureText(value).width;
    const widthScaled = normalWidth * scale;
    const gap = fontSize * random.range(0.07, 0.15);
    if (row.length && used + widthScaled + gap > width) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push({ value, font, scale, width: widthScaled, gap });
    used += widthScaled + gap;
  }
  if (row.length) rows.push(row);

  const paragraph = document.createElement("div");
  paragraph.className = "experimental-paragraph";
  paragraph.style.fontSize = `${fontSize}px`;
  for (const wordsInRow of rows) {
    const line = document.createElement("div");
    line.className = "experimental-line";
    line.style.height = `${fontSize * 1.08}px`;
    wordsInRow.forEach((word, index) => {
      const box = document.createElement("span");
      box.className = "experimental-word";
      box.style.width = `${word.width}px`;
      box.style.height = `${fontSize * 1.08}px`;
      const inner = document.createElement("span");
      inner.textContent = word.value;
      inner.style.fontFamily = word.font;
      inner.style.transform = `scaleX(${word.scale})`;
      box.append(inner);
      line.append(box);
      if (index < wordsInRow.length - 1) {
        const space = document.createElement("span");
        space.className = "experimental-space";
        space.style.width = `${word.gap}px`;
        line.append(space);
      }
    });
    paragraph.append(line);
  }
  return paragraph;
}
