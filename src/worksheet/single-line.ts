/** Turns line breaks, with the whitespace around them, into single spaces. */
export const singleLine = (text: string) => text.replace(/\s*[\r\n]+\s*/g, ' ');
