/** Mirrors a textarea into a backdrop div so a character range can be highlighted behind it. */
export class TextHighlighter {
  constructor(
    private textarea: HTMLTextAreaElement,
    private backdrop: HTMLElement,
  ) {
    textarea.addEventListener("scroll", () => this.syncScroll());
    textarea.addEventListener("input", () => this.clear());
  }

  highlight(start: number, length: number): void {
    const text = this.textarea.value;
    this.backdrop.replaceChildren(
      document.createTextNode(text.slice(0, start)),
      Object.assign(document.createElement("mark"), { textContent: text.slice(start, start + length) }),
      // Trailing newline keeps the backdrop's height in step with the textarea
      document.createTextNode(text.slice(start + length) + "\n"),
    );
    this.syncScroll();
  }

  clear(): void {
    this.backdrop.textContent = "";
  }

  private syncScroll(): void {
    this.backdrop.scrollTop = this.textarea.scrollTop;
  }
}
