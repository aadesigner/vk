/**
 * VW Group body / transmission / trim inference when EU ZZZ VINs
 * don't encode those attributes in US-style VDS positions.
 */

/** Infer body style from a resolved VW/Audi/Škoda/SEAT/Cupra model name. */
export function inferBodyStyleFromModel(model: string | null | undefined): string | null {
  if (!model) return null;
  const m = model.toLowerCase();

  if (/\b(touareg|atlas|tiguan|tayron|t-roc|t-cross|taigo|thar\w*|id\.?\s*[456]|q[2345678]|sq[5678]|macan|cayenne|karoq|kod\w+|enyaq|elroq|ateca|formentor|terracota|encore|arizona|suv)\b/.test(m)) {
    return "SUV / Crossover";
  }
  if (/\b(caddy|touran|sharan|multivan|caravelle|transporter|id\.?\s*buzz|alhambra|roomster)\b/.test(m)) {
    return "MPV / Van";
  }
  if (/\b(amarok|ranger|caddy\s*pickup)\b/.test(m)) {
    return "Pickup";
  }
  if (/\b(variant|avant|sportback|shooting\s*brake|estate|wagon|touring|alltrack|scout)\b/.test(m)) {
    if (/\bsportback\b/.test(m)) return "Sportback / Liftback";
    return "Wagon / Estate";
  }
  if (/\b(cabriolet|cabrio|convertible|roadster|spider|boxster)\b/.test(m)) {
    return "Convertible";
  }
  if (/\b(coup[eé]|cc\b|arteon(?!\s*shooting)|scirocco|tt\b)\b/.test(m)) {
    return "Coupé";
  }
  if (/\b(golf|polo|up!|ibiza|fabia|leon|octavia|id\.?\s*3|a1|a3)\b/.test(m) && !/\b(sedan|limousine|variant)\b/.test(m)) {
    return "Hatchback";
  }
  if (/\b(passat|jetta|superb|id\.?\s*7|a4|a6|a8|panamera|phaeton|vento)\b/.test(m)) {
    return "Sedan";
  }
  return null;
}

/** Typical factory transmissions for EU VAG models (ZZZ VINs do not encode gearbox). */
export function inferVagTransmissionFromModel(model: string | null | undefined): string | null {
  if (!model) return null;
  const m = model.toLowerCase();

  if (/\b(id\.?\s*[34567]|id\.?\s*buzz|enyaq|elroq|citigoe|born|e-tron|macan\s*electric|taycan)\b/.test(m)) {
    return "Single-Speed Automatic";
  }
  if (/\b(touareg|atlas|cayenne|macan|q[78]|phaeton|arteon|passat|superb|a[68]|panamera)\b/.test(m)) {
    return "Automatic (typically 7–8 speed)";
  }
  if (/\b(tiguan|t-roc|t-cross|taigo|karoq|kod\w+|ateca|formentor|q[345])\b/.test(m)) {
    return "Manual or DSG / Automatic";
  }
  if (/\b(golf|polo|leon|ibiza|fabia|octavia|a3)\b/.test(m)) {
    return "Manual or DSG (Dual-Clutch)";
  }
  return "Manual or Automatic";
}

/** Drive type when model line is strongly associated with AWD/4MOTION. */
export function inferVagDriveFromModel(model: string | null | undefined): string | null {
  if (!model) return null;
  const m = model.toLowerCase();
  if (/\b(touareg|atlas\s*cross\s*sport|cayenne|macan|q[78]|alltrack|4motion|quattro)\b/.test(m)) {
    return "All-Wheel Drive";
  }
  // MEB/PPE electric models can be rear- or all-wheel drive; do not infer FWD.
  if (/\b(up!|polo(?!\s*gti)|taigo)\b/.test(m)) {
    return "Front-Wheel Drive";
  }
  return null;
}
