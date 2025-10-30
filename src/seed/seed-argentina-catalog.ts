import "dotenv/config";
import { DataSource } from "typeorm";

/* =======================
   ENTIDADES PRINCIPALES
========================== */
import { Brand } from "../brands/brand.entity";
import { Model } from "../models/model.entity";
import { Version } from "../versions/version.entity";
import { Vehicle } from "../vehicles/vehicle.entity";
import { Client } from "../clients/entities/client.entity";
import { Purchase } from "../purchases/purchase.entity";
import { Sale } from "../sales/sale.entity";
import { Installment } from "../installments/installment.entity";
import { InstallmentPayment } from "../installment-payments/installment-payment.entity";


/* =======================
   CONEXIÓN A BASE DE DATOS
========================== */
const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432", 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
entities: [
  Brand,
  Model,
  Version,
  Vehicle,
  Purchase,
  Client,
  Sale,
  Installment,
  InstallmentPayment,
],
  synchronize: false,
});

/* =======================
   TIPOS Y SEED DATA
========================== */
type SeedVersionedModel = { name: string; versions: string[] };
type SeedBrand = { name: string; models: SeedVersionedModel[] };

const seedData: SeedBrand[] = [
  {
    name: "Toyota",
    models: [
      { name: "Corolla", versions: ["XLi", "XEi", "SE-G", "GR-S", "Hybrid XEi", "Hybrid SE-G"] },
      { name: "Corolla Cross", versions: ["XEi", "SEG", "GR-S", "Hybrid XEi", "Hybrid SEG"] },
      { name: "Yaris", versions: ["XS", "XL", "S", "GR-S"] },
      { name: "Etios", versions: ["X", "XS", "XLS", "Cross"] },
      { name: "Hilux", versions: ["DX 4x2", "DX 4x4", "SR 4x2", "SRV 4x4 AT", "SRX 4x4 AT", "GR-S"] },
      { name: "SW4", versions: ["SR", "SRV", "SRX", "GR-S"] },
      { name: "RAV4", versions: ["XLE", "Limited", "Hybrid AWD"] },
      { name: "Prius", versions: ["1.8 Hybrid"] },
    ],
  },
  {
    name: "Volkswagen",
    models: [
      { name: "Gol", versions: ["Trendline", "Comfortline", "Highline", "Power"] },
      { name: "Polo", versions: ["Trendline", "Comfortline", "Highline", "GTS"] },
      { name: "Virtus", versions: ["Trendline", "Comfortline", "Highline", "GTS"] },
      { name: "Vento", versions: ["Trendline", "Comfortline", "Highline", "GLI"] },
      { name: "Amarok", versions: ["Trendline 2.0", "Highline 2.0", "V6 224cv Highline", "V6 258cv Extreme"] },
      { name: "T-Cross", versions: ["Trendline", "Comfortline", "Highline", "Hero"] },
      { name: "Nivus", versions: ["Comfortline", "Highline"] },
      { name: "Saveiro", versions: ["Cabina Simple", "Cabina Extendida", "Cross"] },
      { name: "Suran", versions: ["Trendline", "Highline", "Cross"] },
    ],
  },
  {
    name: "Chevrolet",
    models: [
      { name: "Onix", versions: ["Joy", "LT", "LTZ", "Premier", "Turbo"] },
      { name: "Onix Plus", versions: ["LT", "LTZ", "Premier"] },
      { name: "Prisma", versions: ["Joy", "LT", "LTZ"] },
      { name: "Cruze", versions: ["LT", "LTZ", "Premier", "Hatch", "Sedan"] },
      { name: "Tracker", versions: ["LT", "LTZ", "Premier", "Turbo"] },
      { name: "S10", versions: ["Cabina Simple", "LT", "LTZ", "High Country"] },
      { name: "Spin", versions: ["LT", "Activ", "Premier"] },
      { name: "Corsa Classic", versions: ["Base", "GL", "GLS", "Wagon"] },
      { name: "Agile", versions: ["LT", "LTZ"] },
    ],
  },
  {
    name: "Ford",
    models: [
      { name: "Ka", versions: ["S", "SE", "SEL", "Freestyle"] },
      { name: "Fiesta", versions: ["S", "SE", "SE Plus", "Titanium"] },
      { name: "Focus", versions: ["S", "SE", "SE Plus", "Titanium"] },
      { name: "Ranger", versions: ["XL", "XLS", "XLT", "Limited", "Limited+", "Raptor"] },
      { name: "EcoSport", versions: ["S", "SE", "Titanium", "Storm"] },
      { name: "Kuga", versions: ["SE", "Titanium", "Hybrid"] },
      { name: "Mondeo", versions: ["SE", "Titanium"] },
      { name: "Maverick", versions: ["XLT Hybrid", "Lariat FX4"] },
      { name: "Territory", versions: ["SEL", "Titanium"] },
    ],
  },
  {
    name: "Renault",
    models: [
      { name: "Clio", versions: ["Auth", "Confort", "Privilege", "Mío"] },
      { name: "Logan", versions: ["Life", "Zen", "Intens"] },
      { name: "Sandero", versions: ["Life", "Zen", "Intens", "RS"] },
      { name: "Stepway", versions: ["Zen", "Intens"] },
      { name: "Duster", versions: ["Zen", "Intens", "Iconic", "4x4"] },
      { name: "Kangoo", versions: ["Express", "Confort", "Pass"] },
      { name: "Fluence", versions: ["Dynamique", "Privilege", "GT"] },
      { name: "Megane", versions: ["I", "II", "III GT", "E-Tech"] },
      { name: "Alaskan", versions: ["Confort", "Intens", "Iconic"] },
      { name: "Oroch", versions: ["Confort", "Intens", "Outsider"] },
    ],
  },
  {
    name: "Peugeot",
    models: [
      { name: "206", versions: ["XR", "XS", "XT", "XS Premium", "XT Premium"] },
      { name: "207 Compact", versions: ["Active", "Allure"] },
      { name: "208", versions: ["Like", "Active", "Allure", "Feline", "GT"] },
      { name: "307", versions: ["XS", "XR", "Premium"] },
      { name: "308", versions: ["Active", "Allure", "Feline", "Sport", "GTI", "S GT", "S GTI"] },
      { name: "408", versions: ["Active", "Allure", "Feline"] },
      { name: "Partner", versions: ["VUL", "Patagónica"] },
      { name: "Rifter", versions: ["Allure", "GT Line"] },
    ],
  },
  {
    name: "Citroën",
    models: [
      { name: "C3", versions: ["Live", "Feel", "Shine"] },
      { name: "C4", versions: ["X", "SX", "VTS", "HDI"] },
      { name: "C4 Cactus", versions: ["Feel", "Shine", "Rip Curl"] },
      { name: "C4 Lounge", versions: ["Feel", "Shine", "THP"] },
      { name: "Berlingo", versions: ["VUL", "Multispace"] },
      { name: "C-Elysée", versions: ["Feel", "Shine"] },
      { name: "Jumper", versions: ["L2H2", "L3H2"] },
      { name: "Jumpy", versions: ["Confort", "Business"] },
    ],
  },
  {
    name: "Fiat",
    models: [
      { name: "Palio", versions: ["Attractive", "Essence", "Sporting"] },
      { name: "Siena", versions: ["EL", "Attractive"] },
      { name: "Uno", versions: ["Way", "Attractive"] },
      { name: "Punto", versions: ["Attractive", "Essence", "Sporting"] },
      { name: "Argo", versions: ["Drive", "Precision", "HGT"] },
      { name: "Cronos", versions: ["Like", "Drive", "Precision"] },
      { name: "Strada", versions: ["Endurance", "Freedom", "Volcano"] },
      { name: "Toro", versions: ["Freedom", "Volcano", "Ranch", "Ultra"] },
      { name: "Fiorino", versions: ["VUL"] },
      { name: "Doblo", versions: ["Cargo", "Passenger"] },
      { name: "Ducato", versions: ["Cargo", "Maxi"] },
    ],
  },
  {
    name: "Nissan",
    models: [
      { name: "March", versions: ["Sense", "Advance", "Exclusive"] },
      { name: "Versa", versions: ["Sense", "Advance", "Exclusive"] },
      { name: "Sentra", versions: ["Sense", "Advance", "SR", "Exclusive"] },
      { name: "Kicks", versions: ["Sense", "Advance", "Exclusive"] },
      { name: "Frontier", versions: ["S", "SE", "XE", "LE", "Pro-4X"] },
      { name: "X-Trail", versions: ["Advance", "Exclusive", "Hybrid"] },
    ],
  },
  {
    name: "Honda",
    models: [
      { name: "City", versions: ["LX", "EX", "EXL"] },
      { name: "Civic", versions: ["EX", "EXL", "Touring"] },
      { name: "Fit", versions: ["LX", "EX", "EXL"] },
      { name: "HR-V", versions: ["LX", "EX", "EXL", "Touring"] },
      { name: "WR-V", versions: ["EX", "EXL"] },
      { name: "CR-V", versions: ["EX", "EXL", "Touring Hybrid"] },
    ],
  },
  {
    name: "Jeep",
    models: [
      { name: "Renegade", versions: ["Sport", "Longitude", "Trailhawk"] },
      { name: "Compass", versions: ["Sport", "Longitude", "Limited", "Trailhawk"] },
      { name: "Commander", versions: ["Limited T270", "Overland TD380"] },
      { name: "Cherokee", versions: ["Limited", "Trailhawk"] },
      { name: "Grand Cherokee", versions: ["Laredo", "Limited", "Overland"] },
    ],
  },
  {
    name: "Hyundai",
    models: [
      { name: "HB20", versions: ["Vision", "Evolution"] },
      { name: "i30", versions: ["GL", "GLS"] },
      { name: "Accent", versions: ["GL", "GLS"] },
      { name: "Elantra", versions: ["GL", "GLS", "Limited"] },
      { name: "Creta", versions: ["Smart", "Limited", "Ultimate"] },
      { name: "Tucson", versions: ["GL", "GLS", "Limited"] },
      { name: "Santa Fe", versions: ["GLS", "Limited", "Hybrid"] },
      { name: "Kona", versions: ["GL", "Limited", "EV"] },
      { name: "H1", versions: ["Full", "Premium"] },
    ],
  },
  {
    name: "Kia",
    models: [
      { name: "Rio", versions: ["LX", "EX"] },
      { name: "Cerato", versions: ["LX", "EX", "SX"] },
      { name: "Soul", versions: ["EX", "EX Premium"] },
      { name: "Sportage", versions: ["LX", "EX", "SX"] },
      { name: "Sorento", versions: ["LX", "EX", "Hybrid"] },
      { name: "Picanto", versions: ["EX"] },
      { name: "Carnival", versions: ["EX", "EX Premium"] },
    ],
  },
  {
    name: "Mitsubishi",
    models: [
      { name: "L200", versions: ["GLS MT", "HPE AT", "4x4"] },
      { name: "Outlander", versions: ["GLS", "Limited", "PHEV"] },
      { name: "ASX", versions: ["GLS"] },
      { name: "Montero", versions: ["GLS 3.2 DiD"] },
    ],
  },
  {
    name: "Chery",
    models: [
      { name: "QQ", versions: ["Light", "Confort"] },
      { name: "Arrizo 5", versions: ["Base", "Confort"] },
      { name: "Tiggo 2", versions: ["Confort", "Luxury"] },
      { name: "Tiggo 4", versions: ["Confort", "Luxury"] },
      { name: "Tiggo 7", versions: ["Confort", "Luxury"] },
      { name: "Tiggo 8", versions: ["Luxury"] },
    ],
  },
  {
    name: "DS",
    models: [
      { name: "DS3", versions: ["So Chic", "Sport Chic"] },
      { name: "DS4", versions: ["So Chic", "Sport"] },
      { name: "DS7", versions: ["So Chic", "Grand Chic", "E-Tense"] },
    ],
  },
  {
    name: "BMW",
    models: [
      { name: "Serie 1", versions: ["118i", "120i", "125i", "135i", "1M"] },
      { name: "Serie 2", versions: ["220i", "235i", "240i", "M2"] },
      { name: "Serie 3", versions: ["320i", "325i", "330i", "335i", "330e", "M340i", "M3"] },
      { name: "X1", versions: ["sDrive18i", "sDrive20i", "xDrive25i"] },
      { name: "X3", versions: ["xDrive20i", "xDrive30i", "M40i"] },
      { name: "X5", versions: ["xDrive40i", "xDrive45e"] },
    ],
  },
  {
    name: "Audi",
    models: [
      { name: "A1", versions: ["Attraction", "Sportback"] },
      { name: "A3", versions: ["Attraction", "Ambition", "Sedan", "Sportback"] },
      { name: "A4", versions: ["Attraction", "S line", "Allroad"] },
      { name: "Q2", versions: ["35 TFSI", "40 TFSI"] },
      { name: "Q3", versions: ["35 TFSI", "40 TFSI", "S line"] },
      { name: "Q5", versions: ["40 TFSI", "45 TFSI", "S line"] },
    ],
  },
  {
    name: "Mercedes-Benz",
    models: [
      { name: "Clase A", versions: ["A180", "A200", "A250"] },
      { name: "Clase C", versions: ["C200", "C300"] },
      { name: "GLA", versions: ["200", "250"] },
      { name: "GLC", versions: ["250", "300"] },
      { name: "Sprinter", versions: ["Furgón 311", "Furgón 415", "Furgón 516", "Chasis 515"] },
      { name: "Vito", versions: ["Furgón 111", "Tourer 116"] },
    ],
  },
  {
    name: "Volvo",
    models: [
      { name: "XC40", versions: ["T4", "Recharge Pure Electric"] },
      { name: "XC60", versions: ["B5", "T8 Recharge"] },
      { name: "S60", versions: ["T5", "T8 Recharge"] },
    ],
  },
  {
    name: "Subaru",
    models: [
      { name: "Impreza", versions: ["2.0i AWD"] },
      { name: "XV", versions: ["2.0i AWD"] },
      { name: "Forester", versions: ["2.0i AWD", "2.5i Limited"] },
      { name: "Outback", versions: ["2.5i AWD"] },
    ],
  },
  {
    name: "Ram",
    models: [
      { name: "1500", versions: ["Laramie", "Limited", "Night Edition"] },
      { name: "2500", versions: ["Laramie", "Limited"] },
      { name: "1200", versions: ["Double Cab"] },
    ],
  },
  {
    name: "Iveco",
    models: [
      { name: "Daily", versions: ["35S14", "45S17", "70C17"] },
      { name: "Tector", versions: ["Attack", "Cursor"] },
    ],
  },
  {
    name: "Peugeot-Citroën (Stellantis utilitarios)",
    models: [
      { name: "Jumpy", versions: ["Business", "Confort"] },
      { name: "Jumper", versions: ["L2H2", "L3H2"] },
      { name: "Rifter", versions: ["Allure", "GT Line"] },
      { name: "Berlingo", versions: ["VUL", "Multispace"] },
      { name: "Partner", versions: ["VUL", "Patagónica"] },
    ],
  },
];

/* =======================
   CONTADORES
========================== */
let createdBrands = 0;
let createdModels = 0;
let createdVersions = 0;

/* =======================
   HELPERS
========================== */
async function upsertBrand(name: string) {
  const repo = AppDataSource.getRepository(Brand);
  let b = await repo.findOne({ where: { name } });
  if (!b) {
    b = repo.create({ name });
    b = await repo.save(b);
    createdBrands++;
    console.log(`✅ Marca: ${name}`);
  }
  return b;
}

async function upsertModel(brand: Brand, name: string) {
  const repo = AppDataSource.getRepository(Model);
  let m = await repo.findOne({
    where: { name, brand: { id: brand.id } },
    relations: ["brand"],
  });
  if (!m) {
    m = repo.create({ name, brand });
    m = await repo.save(m);
    createdModels++;
    console.log(`  🚗 Modelo: ${brand.name} ${name}`);
  }
  return m;
}

async function upsertVersion(model: Model, name: string) {
  const repo = AppDataSource.getRepository(Version);
  let v = await repo.findOne({
    where: { name, model: { id: model.id } },
    relations: ["model"],
  });
  if (!v) {
    v = repo.create({ name, model });
    v = await repo.save(v);
    createdVersions++;
    console.log(`    🔹 Versión: ${model.name} ${name}`);
  }
  return v;
}

/* =======================
   EJECUCIÓN PRINCIPAL
========================== */
async function seed() {
  console.log("🔄 Conectando a la base de datos…");
  await AppDataSource.initialize();
  console.log("✅ Conectado correctamente.\n");

  for (const brandSeed of seedData) {
    const brand = await upsertBrand(brandSeed.name);
    for (const modelSeed of brandSeed.models) {
      const model = await upsertModel(brand, modelSeed.name);
      for (const versionName of modelSeed.versions) {
        await upsertVersion(model, versionName);
      }
    }
  }

  console.log("\n🎉 Catálogo cargado exitosamente.");
  console.log(`📊 Totales añadidos:`);
  console.log(`   • Marcas nuevas: ${createdBrands}`);
  console.log(`   • Modelos nuevos: ${createdModels}`);
  console.log(`   • Versiones nuevas: ${createdVersions}`);

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error("❌ Error al ejecutar el seed:", err);
  AppDataSource.destroy();
});
