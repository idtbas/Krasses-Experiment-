// Ein Programm mit zwei Gesichtern: Text und Syntaxbaum. Beide bleiben synchron.
import { parse } from '../lang/parser.js';
import { format } from '../lang/format.js';

export class ProgramDoc {
  constructor(text = '', layout = {}) {
    this.text = text;
    this.layout = layout; // Positionen der Baustein-Stapel (Index → {x,y})
    this.ast = null;
    this.error = null;
    this.version = 0;
    this.listeners = new Set();
    this.reparse();
  }

  reparse() {
    try {
      this.ast = parse(this.text);
      this.error = null;
    } catch (e) {
      this.error = e;
    }
  }

  setText(text, source) {
    if (text === this.text) return;
    this.text = text;
    const prevAst = this.ast;
    this.reparse();
    if (this.error) this.ast = prevAst;
    this.version++;
    this.emit(source || 'text');
  }

  // Baustein-Editor hat den Baum verändert
  commitAst(ast, source = 'blocks') {
    this.ast = ast;
    const f = format(ast);
    this.text = f.text;
    this.lineOf = f.lineOf;
    this.error = null;
    this.version++;
    this.emit(source);
  }

  lineMap() {
    if (!this.lineOf || this.lineVersion !== this.version) {
      if (this.ast && !this.error) {
        // Zeilen des tatsächlichen Texts: Baum aus dem Text, nicht aus dem Formatierer
        this.lineOf = null;
      }
      this.lineVersion = this.version;
    }
    return this.lineOf;
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(source) { for (const fn of this.listeners) fn(source); }

  toJSON() { return { code: this.text, layout: this.layout }; }
}
