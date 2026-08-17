const LETRAS_RE = /[a-zA-ZáéíóúÁÉÍÓÚàèìòùÀÈÌÒÙñÑüÜ]/;

// Elimina todo lo que no sea letra (incluye acentos, ñ, ü) ni espacio
export const soloLetras = (v) =>
  v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚàèìòùÀÈÌÒÙñÑüÜ\s]/g, '');

// Elimina todo lo que no sea dígito; cap opcional
export const soloDigitos = (v, max = Infinity) =>
  v.replace(/\D/g, '').slice(0, max);

// true si el texto tiene al menos una letra (útil para validar descripciones)
export const tieneLetras = (v) => LETRAS_RE.test(v);

// Valida que una dirección tenga al menos una letra Y un dígito y mínimo 5 chars
export const esUbicacionValida = (v) => {
  const s = (v || '').trim();
  return s.length >= 5 && LETRAS_RE.test(s) && /\d/.test(s);
};

// Detecta texto sin sentido:
// 1. Un solo carácter repetido ("aaaaa", "bbbbb")
// 2. > 8 letras con menos del 30 % de vocales reales (a,e,i,o,u + tildadas; 'y' NO cuenta)
//    30 %: "transportes y distribuciones" (~35 %) pasa; mashing (~10 %) no.
// 3. 5 o más consonantes seguidas en la cadena de solo letras
export const esRepetitivo = (v) => {
  const s = v.trim().toLowerCase().replace(/\s/g, '');
  if (!s) return false;
  if (s.length > 2 && new Set(s).size === 1) return true;
  const letras = s.replace(/[^a-záéíóúüñ]/g, '');
  if (letras.length <= 8) return false;
  const vowels = (letras.match(/[aeiouáéíóúü]/g) || []).length;
  if (vowels / letras.length < 0.30) return true;
  if (/[^aeiouáéíóúü]{5,}/.test(letras)) return true;
  return false;
};
