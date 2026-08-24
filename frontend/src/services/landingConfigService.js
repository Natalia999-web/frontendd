const KEY = 'toston_landing_config';

export const LANDING_DEFAULTS = {
  heroBadge:          "SABOR NATURAL 100%",
  heroTitle:          "El poder del Plátano",
  heroDescription:    "Descubre tostones, chips y delicias artesanales que redefinen el sabor de nuestra tierra. Crujientes, frescos y recolectados con amor.",
  historyTitle:       "Desde el campo hasta tu mesa",
  historyDescription: "En Tostón App celebramos la tierra. Cada plátano es seleccionado para garantizar una experiencia épica y natural.",
  ctaTitle:           "Únete a la Revolución",
  ctaDescription:     "Estamos transformando la forma en que el mundo ve al plátano.",
  contactPhone1:         "321 754 3305",
  contactPhone2:         "313 789 9946",
  contactAddressLine:    "Carrera 38A No. 80-12",
  contactCity:           "Barranquilla, Colombia",
  contactInstagramUrl:   "https://www.instagram.com/tostonesbroms?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==",
  contactInstagramHandle:"@tostonesbroms",
  horarioLunesViernes:   "8:00 am – 8:00 pm",
  horarioSabado:         "8:00 am – 8:00 pm",
};

export function getLandingConfig() {
  try {
    const saved = localStorage.getItem(KEY);
    if (!saved) return { ...LANDING_DEFAULTS };
    return { ...LANDING_DEFAULTS, ...JSON.parse(saved) };
  } catch {
    return { ...LANDING_DEFAULTS };
  }
}

export function saveLandingConfig(config) {
  localStorage.setItem(KEY, JSON.stringify(config));
}

export function resetLandingConfig() {
  localStorage.removeItem(KEY);
  return { ...LANDING_DEFAULTS };
}
