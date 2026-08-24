export const TIPOS_DOC = ["CC", "TI", "CE", "Pasaporte", "NIT", "PPT"];

export const ITEMS_PER_PAGE = 5;

export const fmtTel = (raw) => {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)} ${d.slice(3)}`;
  return `${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6)}`;
};

export const toInputDate   = v => v && v.includes("/") ? v.split("/").reverse().join("-") : (v || "");
export const fromInputDate = v => { if (!v) return ""; const [y,m,d] = v.split("-"); return `${d}/${m}/${y}`; };

