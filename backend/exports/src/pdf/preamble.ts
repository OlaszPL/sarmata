/**
 * Shared start of every template: data, document metadata, page and text defaults. The typeface comes
 * from `data.fontFamily` and `fallback: false` turns a missing face into an error instead of a quiet swap.
 * `data` needs `title`, `author`, `fontFamily` and optional `isDraft` and `draftMark`.
 */
export const PREAMBLE = String.raw`#let data = json(bytes(sys.inputs.data))
#set document(title: data.title, author: data.author, date: auto)
#set text(lang: "pl", font: data.fontFamily, fallback: false, size: 10pt)
#set page(
  paper: "a4",
  margin: (x: 18mm, top: 22mm, bottom: 20mm),
  header: if data.at("isDraft", default: false) {
    align(right, text(fill: rgb("#b00020"), weight: "bold", size: 14pt)[#data.draftMark])
  },
  footer: context align(center, text(size: 8pt)[#counter(page).display("1 / 1", both: true)]),
)
#set par(leading: 0.6em, spacing: 0.9em)
#show heading.where(level: 1): set text(size: 13pt)
#show heading.where(level: 2): set text(size: 11pt)
#show heading: set block(above: 1.2em, below: 0.7em)
#set table(stroke: 0.5pt + luma(90), inset: 5pt)
`;
