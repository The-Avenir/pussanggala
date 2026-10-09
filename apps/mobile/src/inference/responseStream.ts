/** Reveal only trusted replies or already validated model units, never raw model tokens. */
export class ResponseStream {
  private id = 0;
  private text = '';
  private chunks: string[] = [];
  private finished = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(private readonly update: (id: number, text: string, streaming: boolean) => void) {}

  start(id: number): void {
    this.cancel(); this.id = id; this.text = ''; this.finished = false;
    this.update(id, '', true);
  }
  append(id: number, text: string): void {
    if (id !== this.id || this.finished) return;
    this.chunks.push(...(text.match(/\S+\s*|\s+/g) ?? []));
    if (this.timer === null) this.pump();
  }
  finish(id: number): void { if (id !== this.id) return; this.finished = true; if (this.timer === null) this.pump(); }
  cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null; this.chunks = []; this.finished = true;
    if (this.id) this.update(this.id, this.text, false);
  }
  private pump(): void {
    this.timer = null;
    if (this.chunks.length) {
      this.text += this.chunks.splice(0, 3).join('');
      this.update(this.id, this.text, true);
      this.timer = setTimeout(() => this.pump(), 25);
    } else if (this.finished) this.update(this.id, this.text, false);
  }
}
