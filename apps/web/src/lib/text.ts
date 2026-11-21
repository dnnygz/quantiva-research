/** First sentence of a paragraph; decimal points like "0.8297" do not end a sentence. */
export function firstSentence(text: string) {
  const m = text.match(/^.*?[.;](?=\s+[A-Z(]|\s*$)/s);
  return (m ? m[0] : text).trim();
}
