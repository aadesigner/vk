/**
 * International dialing prefixes for profile phone numbers.
 * Independent of the user's country / nationality selection.
 */
export type PhonePrefixOption = {
  /** E.164 country calling code with leading +, e.g. "+355" */
  dial: string;
  /** Short label for the option list */
  label: string;
  /** Search haystack */
  search: string;
};

const RAW: Array<{ dial: string; label: string; aliases?: string }> = [
  { dial: "+355", label: "Albania (+355)", aliases: "al albania shqiperi" },
  { dial: "+383", label: "Kosovo (+383)", aliases: "xk kosovo kosova" },
  { dial: "+93", label: "Afghanistan (+93)" },
  { dial: "+213", label: "Algeria (+213)" },
  { dial: "+376", label: "Andorra (+376)" },
  { dial: "+244", label: "Angola (+244)" },
  { dial: "+54", label: "Argentina (+54)" },
  { dial: "+374", label: "Armenia (+374)" },
  { dial: "+61", label: "Australia (+61)" },
  { dial: "+43", label: "Austria (+43)" },
  { dial: "+994", label: "Azerbaijan (+994)" },
  { dial: "+973", label: "Bahrain (+973)" },
  { dial: "+880", label: "Bangladesh (+880)" },
  { dial: "+375", label: "Belarus (+375)" },
  { dial: "+32", label: "Belgium (+32)" },
  { dial: "+501", label: "Belize (+501)" },
  { dial: "+229", label: "Benin (+229)" },
  { dial: "+975", label: "Bhutan (+975)" },
  { dial: "+591", label: "Bolivia (+591)" },
  { dial: "+387", label: "Bosnia and Herzegovina (+387)" },
  { dial: "+267", label: "Botswana (+267)" },
  { dial: "+55", label: "Brazil (+55)" },
  { dial: "+673", label: "Brunei (+673)" },
  { dial: "+359", label: "Bulgaria (+359)" },
  { dial: "+226", label: "Burkina Faso (+226)" },
  { dial: "+257", label: "Burundi (+257)" },
  { dial: "+855", label: "Cambodia (+855)" },
  { dial: "+237", label: "Cameroon (+237)" },
  { dial: "+1", label: "Canada / USA (+1)", aliases: "ca us usa canada america" },
  { dial: "+238", label: "Cape Verde (+238)" },
  { dial: "+236", label: "Central African Republic (+236)" },
  { dial: "+235", label: "Chad (+235)" },
  { dial: "+56", label: "Chile (+56)" },
  { dial: "+86", label: "China (+86)" },
  { dial: "+57", label: "Colombia (+57)" },
  { dial: "+269", label: "Comoros (+269)" },
  { dial: "+242", label: "Congo (+242)" },
  { dial: "+243", label: "Congo (DRC) (+243)" },
  { dial: "+506", label: "Costa Rica (+506)" },
  { dial: "+385", label: "Croatia (+385)" },
  { dial: "+53", label: "Cuba (+53)" },
  { dial: "+357", label: "Cyprus (+357)" },
  { dial: "+420", label: "Czechia (+420)" },
  { dial: "+45", label: "Denmark (+45)" },
  { dial: "+253", label: "Djibouti (+253)" },
  { dial: "+593", label: "Ecuador (+593)" },
  { dial: "+20", label: "Egypt (+20)" },
  { dial: "+503", label: "El Salvador (+503)" },
  { dial: "+240", label: "Equatorial Guinea (+240)" },
  { dial: "+291", label: "Eritrea (+291)" },
  { dial: "+372", label: "Estonia (+372)" },
  { dial: "+268", label: "Eswatini (+268)" },
  { dial: "+251", label: "Ethiopia (+251)" },
  { dial: "+679", label: "Fiji (+679)" },
  { dial: "+358", label: "Finland (+358)" },
  { dial: "+33", label: "France (+33)" },
  { dial: "+241", label: "Gabon (+241)" },
  { dial: "+220", label: "Gambia (+220)" },
  { dial: "+995", label: "Georgia (+995)" },
  { dial: "+49", label: "Germany (+49)" },
  { dial: "+233", label: "Ghana (+233)" },
  { dial: "+30", label: "Greece (+30)" },
  { dial: "+502", label: "Guatemala (+502)" },
  { dial: "+224", label: "Guinea (+224)" },
  { dial: "+245", label: "Guinea-Bissau (+245)" },
  { dial: "+592", label: "Guyana (+592)" },
  { dial: "+509", label: "Haiti (+509)" },
  { dial: "+504", label: "Honduras (+504)" },
  { dial: "+852", label: "Hong Kong (+852)" },
  { dial: "+36", label: "Hungary (+36)" },
  { dial: "+354", label: "Iceland (+354)" },
  { dial: "+91", label: "India (+91)" },
  { dial: "+62", label: "Indonesia (+62)" },
  { dial: "+98", label: "Iran (+98)" },
  { dial: "+964", label: "Iraq (+964)" },
  { dial: "+353", label: "Ireland (+353)" },
  { dial: "+972", label: "Israel (+972)" },
  { dial: "+39", label: "Italy (+39)" },
  { dial: "+225", label: "Ivory Coast (+225)" },
  { dial: "+81", label: "Japan (+81)" },
  { dial: "+962", label: "Jordan (+962)" },
  { dial: "+7", label: "Kazakhstan / Russia (+7)", aliases: "kz ru russia kazakhstan" },
  { dial: "+254", label: "Kenya (+254)" },
  { dial: "+965", label: "Kuwait (+965)" },
  { dial: "+996", label: "Kyrgyzstan (+996)" },
  { dial: "+856", label: "Laos (+856)" },
  { dial: "+371", label: "Latvia (+371)" },
  { dial: "+961", label: "Lebanon (+961)" },
  { dial: "+266", label: "Lesotho (+266)" },
  { dial: "+231", label: "Liberia (+231)" },
  { dial: "+218", label: "Libya (+218)" },
  { dial: "+423", label: "Liechtenstein (+423)" },
  { dial: "+370", label: "Lithuania (+370)" },
  { dial: "+352", label: "Luxembourg (+352)" },
  { dial: "+853", label: "Macau (+853)" },
  { dial: "+261", label: "Madagascar (+261)" },
  { dial: "+265", label: "Malawi (+265)" },
  { dial: "+60", label: "Malaysia (+60)" },
  { dial: "+960", label: "Maldives (+960)" },
  { dial: "+223", label: "Mali (+223)" },
  { dial: "+356", label: "Malta (+356)" },
  { dial: "+222", label: "Mauritania (+222)" },
  { dial: "+230", label: "Mauritius (+230)" },
  { dial: "+52", label: "Mexico (+52)" },
  { dial: "+373", label: "Moldova (+373)" },
  { dial: "+377", label: "Monaco (+377)" },
  { dial: "+976", label: "Mongolia (+976)" },
  { dial: "+382", label: "Montenegro (+382)" },
  { dial: "+212", label: "Morocco (+212)" },
  { dial: "+258", label: "Mozambique (+258)" },
  { dial: "+95", label: "Myanmar (+95)" },
  { dial: "+264", label: "Namibia (+264)" },
  { dial: "+977", label: "Nepal (+977)" },
  { dial: "+31", label: "Netherlands (+31)" },
  { dial: "+64", label: "New Zealand (+64)" },
  { dial: "+505", label: "Nicaragua (+505)" },
  { dial: "+227", label: "Niger (+227)" },
  { dial: "+234", label: "Nigeria (+234)" },
  { dial: "+850", label: "North Korea (+850)" },
  { dial: "+389", label: "North Macedonia (+389)" },
  { dial: "+47", label: "Norway (+47)" },
  { dial: "+968", label: "Oman (+968)" },
  { dial: "+92", label: "Pakistan (+92)" },
  { dial: "+970", label: "Palestine (+970)" },
  { dial: "+507", label: "Panama (+507)" },
  { dial: "+675", label: "Papua New Guinea (+675)" },
  { dial: "+595", label: "Paraguay (+595)" },
  { dial: "+51", label: "Peru (+51)" },
  { dial: "+63", label: "Philippines (+63)" },
  { dial: "+48", label: "Poland (+48)" },
  { dial: "+351", label: "Portugal (+351)" },
  { dial: "+974", label: "Qatar (+974)" },
  { dial: "+40", label: "Romania (+40)" },
  { dial: "+250", label: "Rwanda (+250)" },
  { dial: "+966", label: "Saudi Arabia (+966)" },
  { dial: "+221", label: "Senegal (+221)" },
  { dial: "+381", label: "Serbia (+381)" },
  { dial: "+248", label: "Seychelles (+248)" },
  { dial: "+232", label: "Sierra Leone (+232)" },
  { dial: "+65", label: "Singapore (+65)" },
  { dial: "+421", label: "Slovakia (+421)" },
  { dial: "+386", label: "Slovenia (+386)" },
  { dial: "+252", label: "Somalia (+252)" },
  { dial: "+27", label: "South Africa (+27)" },
  { dial: "+82", label: "South Korea (+82)" },
  { dial: "+211", label: "South Sudan (+211)" },
  { dial: "+34", label: "Spain (+34)" },
  { dial: "+94", label: "Sri Lanka (+94)" },
  { dial: "+249", label: "Sudan (+249)" },
  { dial: "+597", label: "Suriname (+597)" },
  { dial: "+46", label: "Sweden (+46)" },
  { dial: "+41", label: "Switzerland (+41)" },
  { dial: "+963", label: "Syria (+963)" },
  { dial: "+886", label: "Taiwan (+886)" },
  { dial: "+992", label: "Tajikistan (+992)" },
  { dial: "+255", label: "Tanzania (+255)" },
  { dial: "+66", label: "Thailand (+66)" },
  { dial: "+228", label: "Togo (+228)" },
  { dial: "+216", label: "Tunisia (+216)" },
  { dial: "+90", label: "Turkey (+90)" },
  { dial: "+993", label: "Turkmenistan (+993)" },
  { dial: "+256", label: "Uganda (+256)" },
  { dial: "+380", label: "Ukraine (+380)" },
  { dial: "+971", label: "United Arab Emirates (+971)", aliases: "uae dubai" },
  { dial: "+44", label: "United Kingdom (+44)", aliases: "uk england britain gb" },
  { dial: "+598", label: "Uruguay (+598)" },
  { dial: "+998", label: "Uzbekistan (+998)" },
  { dial: "+58", label: "Venezuela (+58)" },
  { dial: "+84", label: "Vietnam (+84)" },
  { dial: "+967", label: "Yemen (+967)" },
  { dial: "+260", label: "Zambia (+260)" },
  { dial: "+263", label: "Zimbabwe (+263)" },
];

const OPTIONS: PhonePrefixOption[] = RAW.map((r) => ({
  dial: r.dial,
  label: r.label,
  search: `${r.dial} ${r.label} ${r.aliases ?? ""}`.toLowerCase(),
})).sort((a, b) => a.label.localeCompare(b.label, "en"));

const DIAL_SET = new Set(OPTIONS.map((o) => o.dial));

export function getPhonePrefixOptions(): PhonePrefixOption[] {
  return OPTIONS;
}

export function isAllowedPhonePrefix(prefix: string | null | undefined): boolean {
  if (!prefix) return false;
  return DIAL_SET.has(prefix.trim());
}

/** Digits only; strip spaces/dashes/parens. Reject if any letter remains. */
export function normalizePhoneNational(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (/[^\d\s\-().+]/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length < 4 || digits.length > 15) return null;
  return digits;
}

export function parsePhonePrefix(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  const withPlus = t.startsWith("+") ? t : `+${t.replace(/^\+/, "")}`;
  return isAllowedPhonePrefix(withPlus) ? withPlus : null;
}

export type ParsedPhone = { prefix: string | null; national: string | null };

/**
 * Accepts partial clear (both empty) or a full pair.
 * Returns null if the combination is invalid.
 */
export function parseUserPhone(input: {
  phonePrefix?: string | null;
  phoneNational?: string | null;
}): ParsedPhone | null {
  const rawPrefix = input.phonePrefix;
  const rawNational = input.phoneNational;
  const prefixEmpty = rawPrefix == null || String(rawPrefix).trim() === "";
  const nationalEmpty = rawNational == null || String(rawNational).trim() === "";

  if (prefixEmpty && nationalEmpty) {
    return { prefix: null, national: null };
  }
  if (prefixEmpty || nationalEmpty) return null;

  const prefix = parsePhonePrefix(rawPrefix);
  const national = normalizePhoneNational(rawNational);
  if (!prefix || !national) return null;
  return { prefix, national };
}

export function formatPhoneDisplay(prefix: string | null | undefined, national: string | null | undefined): string | null {
  if (!prefix || !national) return null;
  return `${prefix} ${national}`;
}
