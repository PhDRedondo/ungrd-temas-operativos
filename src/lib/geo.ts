export type Department = {
  name: string;
  code: string;
  lat: number;
  lng: number;
  municipalities: { name: string; lat: number; lng: number }[];
};

export const DEPARTMENTS: Department[] = [
  {
    name: "Antioquia",
    code: "05",
    lat: 6.2518,
    lng: -75.5636,
    municipalities: [
      { name: "Medellín", lat: 6.2476, lng: -75.5658 },
      { name: "Bello", lat: 6.3373, lng: -75.558 },
      { name: "Apartadó", lat: 7.88299, lng: -76.6259 },
    ],
  },
  {
    name: "Atlántico",
    code: "08",
    lat: 10.9685,
    lng: -74.7813,
    municipalities: [
      { name: "Barranquilla", lat: 10.9685, lng: -74.7813 },
      { name: "Soledad", lat: 10.9184, lng: -74.7646 },
    ],
  },
  {
    name: "Bogotá D.C.",
    code: "11",
    lat: 4.711,
    lng: -74.0721,
    municipalities: [
      { name: "Bogotá", lat: 4.711, lng: -74.0721 },
      { name: "Usaquén", lat: 4.748, lng: -74.03 },
    ],
  },
  {
    name: "Bolívar",
    code: "13",
    lat: 10.391,
    lng: -75.4794,
    municipalities: [
      { name: "Cartagena", lat: 10.391, lng: -75.4794 },
      { name: "Magangué", lat: 9.242, lng: -74.7547 },
    ],
  },
  {
    name: "Boyacá",
    code: "15",
    lat: 5.4545,
    lng: -73.362,
    municipalities: [
      { name: "Tunja", lat: 5.5353, lng: -73.3678 },
      { name: "Duitama", lat: 5.8245, lng: -73.0341 },
    ],
  },
  {
    name: "Caldas",
    code: "17",
    lat: 5.0689,
    lng: -75.5174,
    municipalities: [
      { name: "Manizales", lat: 5.0689, lng: -75.5174 },
      { name: "La Dorada", lat: 5.4538, lng: -74.663 },
    ],
  },
  {
    name: "Cauca",
    code: "19",
    lat: 2.4448,
    lng: -76.6147,
    municipalities: [
      { name: "Popayán", lat: 2.4448, lng: -76.6147 },
      { name: "Santander de Quilichao", lat: 3.0094, lng: -76.4849 },
    ],
  },
  {
    name: "Cesar",
    code: "20",
    lat: 10.4631,
    lng: -73.2532,
    municipalities: [
      { name: "Valledupar", lat: 10.4631, lng: -73.2532 },
      { name: "Aguachica", lat: 8.3088, lng: -73.6166 },
    ],
  },
  {
    name: "Córdoba",
    code: "23",
    lat: 8.7479,
    lng: -75.8814,
    municipalities: [
      { name: "Montería", lat: 8.7479, lng: -75.8814 },
      { name: "Lorica", lat: 9.2394, lng: -75.8136 },
    ],
  },
  {
    name: "Cundinamarca",
    code: "25",
    lat: 4.9185,
    lng: -74.0314,
    municipalities: [
      { name: "Soacha", lat: 4.5793, lng: -74.2168 },
      { name: "Zipaquirá", lat: 5.0221, lng: -74.0048 },
    ],
  },
  {
    name: "Huila",
    code: "41",
    lat: 2.9273,
    lng: -75.2819,
    municipalities: [
      { name: "Neiva", lat: 2.9273, lng: -75.2819 },
      { name: "Pitalito", lat: 1.8537, lng: -76.0507 },
    ],
  },
  {
    name: "La Guajira",
    code: "44",
    lat: 11.5446,
    lng: -72.9072,
    municipalities: [
      { name: "Riohacha", lat: 11.5446, lng: -72.9072 },
      { name: "Maicao", lat: 11.3832, lng: -72.2414 },
    ],
  },
  {
    name: "Magdalena",
    code: "47",
    lat: 11.2404,
    lng: -74.211,
    municipalities: [
      { name: "Santa Marta", lat: 11.2404, lng: -74.211 },
      { name: "Ciénega", lat: 11.0069, lng: -74.2476 },
    ],
  },
  {
    name: "Meta",
    code: "50",
    lat: 4.142,
    lng: -73.6266,
    municipalities: [
      { name: "Villavicencio", lat: 4.142, lng: -73.6266 },
      { name: "Acacías", lat: 3.9869, lng: -73.7579 },
    ],
  },
  {
    name: "Nariño",
    code: "52",
    lat: 1.2136,
    lng: -77.2811,
    municipalities: [
      { name: "Pasto", lat: 1.2136, lng: -77.2811 },
      { name: "Tumaco", lat: 1.7986, lng: -78.8156 },
    ],
  },
  {
    name: "Norte de Santander",
    code: "54",
    lat: 7.8891,
    lng: -72.4967,
    municipalities: [
      { name: "Cúcuta", lat: 7.8891, lng: -72.4967 },
      { name: "Ocaña", lat: 8.2376, lng: -73.356 },
    ],
  },
  {
    name: "Quindío",
    code: "63",
    lat: 4.5339,
    lng: -75.6811,
    municipalities: [
      { name: "Armenia", lat: 4.5339, lng: -75.6811 },
      { name: "Calarcá", lat: 4.5297, lng: -75.6454 },
    ],
  },
  {
    name: "Risaralda",
    code: "66",
    lat: 4.8143,
    lng: -75.6946,
    municipalities: [
      { name: "Pereira", lat: 4.8143, lng: -75.6946 },
      { name: "Dosquebradas", lat: 4.8392, lng: -75.6674 },
    ],
  },
  {
    name: "Santander",
    code: "68",
    lat: 7.1193,
    lng: -73.1227,
    municipalities: [
      { name: "Bucaramanga", lat: 7.1193, lng: -73.1227 },
      { name: "Floridablanca", lat: 7.0622, lng: -73.0864 },
    ],
  },
  {
    name: "Sucre",
    code: "70",
    lat: 9.3047,
    lng: -75.3978,
    municipalities: [
      { name: "Sincelejo", lat: 9.3047, lng: -75.3978 },
      { name: "Corozal", lat: 9.316, lng: -75.292 },
    ],
  },
  {
    name: "Tolima",
    code: "73",
    lat: 4.4389,
    lng: -75.2322,
    municipalities: [
      { name: "Ibagué", lat: 4.4389, lng: -75.2322 },
      { name: "Espinal", lat: 4.1492, lng: -74.8843 },
    ],
  },
  {
    name: "Valle del Cauca",
    code: "76",
    lat: 3.4516,
    lng: -76.532,
    municipalities: [
      { name: "Cali", lat: 3.4516, lng: -76.532 },
      { name: "Buenaventura", lat: 3.8801, lng: -77.0312 },
      { name: "Palmira", lat: 3.5394, lng: -76.3036 },
    ],
  },
];

export function departmentNames() {
  return DEPARTMENTS.map((d) => d.name);
}

/** Resuelve coordenadas aproximadas de un registro (municipio o departamento). */
export function resolveLocation(
  departamento: string,
  municipio: string,
): { lat: number; lng: number; label: string; level: "municipio" | "departamento" } | null {
  const dept = DEPARTMENTS.find((d) => d.name === departamento);
  if (!dept) return null;
  const muni = dept.municipalities.find(
    (m) => m.name.toLowerCase() === municipio.toLowerCase(),
  );
  if (muni) {
    return {
      lat: muni.lat,
      lng: muni.lng,
      label: `${muni.name}, ${dept.name}`,
      level: "municipio",
    };
  }
  return {
    lat: dept.lat,
    lng: dept.lng,
    label: dept.name,
    level: "departamento",
  };
}
