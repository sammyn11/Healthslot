/** Five named clinics offered as appointment location choices (synced to DB on startup). */
export const DEFAULT_CLINICS: { name: string; address: string; slug: string }[] = [
  { name: "Amani Community Clinic", address: "Dar es Salaam, Tanzania", slug: "amani-dar" },
  { name: "Lagos Unity Health Centre", address: "Lagos, Nigeria", slug: "lagos-unity" },
  { name: "Kigali Hope Medical Clinic", address: "Kigali, Rwanda", slug: "kigali-hope" },
  { name: "Accra Sunrise Medical Hub", address: "Accra, Ghana", slug: "accra-sunrise" },
  { name: "Cape Wellness Family Clinic", address: "Cape Town, South Africa", slug: "cape-wellness" },
];

export const CLINIC_SLUG_ORDER = DEFAULT_CLINICS.map((c) => c.slug);
